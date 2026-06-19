/**
 * Activity Log Service
 * Stores user activity logs in IndexedDB with 180-day retention.
 * Only accessible by super-admin users.
 */

import { getCentralActivityTicketId, uploadActivityLogEntry, fetchActivityLogsFromGLPI } from './api.js';

const RETENTION_DAYS = 180;

// --- Action Types ---
export const ACTION_TYPES = {
  LOGIN: { key: 'LOGIN', label: 'Login', icon: '🔐', color: '#10b981' },
  LOGOUT: { key: 'LOGOUT', label: 'Logout', icon: '🚪', color: '#64748b' },
  PHOTO_CAPTURED: { key: 'PHOTO_CAPTURED', label: 'Foto Diambil', icon: '📸', color: '#3b82f6' },
  PHOTO_UPLOADED: { key: 'PHOTO_UPLOADED', label: 'Foto Diupload', icon: '📤', color: '#6366f1' },
  BG_REMOVED: { key: 'BG_REMOVED', label: 'Background Removed', icon: '✨', color: '#8b5cf6' },
  BG_RECLEAN: { key: 'BG_RECLEAN', label: 'Re-clean Background', icon: '🔄', color: '#f59e0b' },
  CARD_APPROVED: { key: 'CARD_APPROVED', label: 'ID Card Approved', icon: '✅', color: '#059669' },
  CARD_DOWNLOADED: { key: 'CARD_DOWNLOADED', label: 'Download ID Card', icon: '⬇️', color: '#0891b2' },
  CARD_CANCELLED: { key: 'CARD_CANCELLED', label: 'ID Card Dibatalkan', icon: '❌', color: '#dc2626' },
  PHOTO_RETAKE: { key: 'PHOTO_RETAKE', label: 'Retake Foto', icon: '🔁', color: '#ea580c' },
  GLPI_USER_CREATED: { key: 'GLPI_USER_CREATED', label: 'User GLPI Dibuat', icon: '👤', color: '#2563eb' },
  SETTINGS_CHANGED: { key: 'SETTINGS_CHANGED', label: 'Settings Diubah', icon: '⚙️', color: '#475569' },
  IDCARD_PRINTED: { key: 'IDCARD_PRINTED', label: 'ID Card Dicetak', icon: '🖨️', color: '#8b5cf6' },
};

/**
 * Get current logged-in user info
 */
function getCurrentUser() {
  try {
    const pStr = localStorage.getItem('solusiku_user_profile') || sessionStorage.getItem('solusiku_user_profile');
    if (pStr) {
      const p = JSON.parse(pStr);
      return p.name || 'Unknown';
    }
  } catch (e) { /* ignore */ }
  return 'Unknown';
}

/**
 * Log an activity event
 * @param {string} action - One of ACTION_TYPES keys
 * @param {object} details - Additional details about the action
 */
export async function logActivity(action, details = {}) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      action: action,
      user: getCurrentUser(),
      details: details,
    };

    // Fire and forget, don't block the UI
    setTimeout(async () => {
      try {
        await uploadActivityLogEntry(entry);
      } catch (err) {
        console.warn('[ActivityLog] Failed to sync activity to GLPI', err);
      }
    }, 0);
  } catch (err) {
    console.warn('[ActivityLog] Failed to log activity:', err);
  }
}

/**
 * Get activities with optional filters
 * @param {object} filters - { action, dateFrom, dateTo, search, limit, offset }
 * @returns {Promise<{entries: Array, total: number}>}
 */
export async function getActivities(filters = {}) {
  try {
    // Get all entries from centralized GLPI server
    const allEntries = await fetchActivityLogsFromGLPI();

    // Apply filters
    let filtered = allEntries;

    if (filters.action && filters.action !== 'ALL') {
      filtered = filtered.filter(e => e.action === filters.action);
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(e => new Date(e.timestamp) >= from);
    }

    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(e => new Date(e.timestamp) <= to);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(e =>
        (e.user || '').toLowerCase().includes(q) ||
        (e.action || '').toLowerCase().includes(q) ||
        JSON.stringify(e.details || {}).toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    const entries = filtered.slice(offset, offset + limit);

    return { entries, total };
  } catch (err) {
    console.error('[ActivityLog] Failed to get activities:', err);
    return { entries: [], total: 0 };
  }
}

/**
 * Get activity stats summary
 */
export async function getActivityStats() {
  try {
    const allEntries = await fetchActivityLogsFromGLPI();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEntries = allEntries.filter(e => new Date(e.timestamp) >= today);

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const weekEntries = allEntries.filter(e => new Date(e.timestamp) >= last7Days);

    return {
      total: allEntries.length,
      today: todayEntries.length,
      thisWeek: weekEntries.length,
      uniqueUsers: new Set(allEntries.map(e => e.user)).size,
    };
  } catch (err) {
    return { total: 0, today: 0, thisWeek: 0, uniqueUsers: 0 };
  }
}

/**
 * Clear all activity logs
 */
export async function clearActivities() {
  try {
    // Send a CLEAR_ALL marker to wipe memory locally
    const success = await uploadActivityLogEntry({ action: 'CLEAR_ALL', timestamp: new Date().toISOString() });
    return success;
  } catch (err) {
    console.error('[ActivityLog] Failed to clear:', err);
    return false;
  }
}

/**
 * Export activities to CSV file
 */
export async function exportActivitiesToCSV(filters = {}) {
  const { entries } = await getActivities({ ...filters, limit: 99999, offset: 0 });

  const headers = ['Waktu', 'User', 'Aksi', 'Detail'];
  const rows = entries.map(e => {
    const actionInfo = ACTION_TYPES[e.action] || { label: e.action };
    const detailStr = Object.entries(e.details || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
    const timeStr = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(e.timestamp));
    return [timeStr, e.user, actionInfo.label, detailStr];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `activity_log_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
