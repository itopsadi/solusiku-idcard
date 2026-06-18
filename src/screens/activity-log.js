import { getActivities, getActivityStats, clearActivities, exportActivitiesToCSV, ACTION_TYPES } from '../services/activity-log.js';
import { showToast } from '../utils/toast.js';
import { debounce, formatDate } from '../utils/helpers.js';

const PAGE_SIZE = 30;

export async function renderActivityLog(container) {
  const stats = await getActivityStats();

  // Current filter state
  let currentFilters = { action: 'ALL', dateFrom: '', dateTo: '', search: '', limit: PAGE_SIZE, offset: 0 };
  let currentTotal = 0;

  container.innerHTML = `
    <div class="page-header">
      <h1>Aktivitas Log</h1>
      <p>Riwayat seluruh aktivitas pengguna dalam sistem ID Card</p>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid" style="margin-bottom:24px;">
      <div class="stat-card animate-in delay-1" style="--card-accent: var(--gradient-1)">
        <div class="stat-icon" style="background:rgba(99,102,241,0.12);color:var(--accent)">📊</div>
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">Total Log</div>
      </div>
      <div class="stat-card animate-in delay-2" style="--card-accent: linear-gradient(135deg, #3b82f6, #6366f1)">
        <div class="stat-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6">📅</div>
        <div class="stat-value">${stats.today}</div>
        <div class="stat-label">Hari Ini</div>
      </div>
      <div class="stat-card animate-in delay-3" style="--card-accent: linear-gradient(135deg, #f59e0b, #ef4444)">
        <div class="stat-icon" style="background:rgba(245,158,11,0.12);color:var(--amber)">📆</div>
        <div class="stat-value">${stats.thisWeek}</div>
        <div class="stat-label">7 Hari Terakhir</div>
      </div>
      <div class="stat-card animate-in delay-4" style="--card-accent: var(--gradient-2)">
        <div class="stat-icon" style="background:rgba(16,185,129,0.12);color:var(--emerald)">👥</div>
        <div class="stat-value">${stats.uniqueUsers}</div>
        <div class="stat-label">User Aktif</div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="activity-filter-bar animate-in" style="animation-delay:0.2s">
      <div class="activity-filter-row">
        <div class="activity-filter-group">
          <label>Tipe Aksi</label>
          <select id="filter-action" class="activity-select">
            <option value="ALL">Semua Aksi</option>
            ${Object.entries(ACTION_TYPES).map(([key, val]) =>
              `<option value="${key}">${val.icon} ${val.label}</option>`
            ).join('')}
          </select>
        </div>
        <div class="activity-filter-group">
          <label>Dari Tanggal</label>
          <input type="date" id="filter-date-from" class="activity-input" />
        </div>
        <div class="activity-filter-group">
          <label>Sampai Tanggal</label>
          <input type="date" id="filter-date-to" class="activity-input" />
        </div>
        <div class="activity-filter-group activity-filter-search">
          <label>Cari</label>
          <div class="activity-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" id="filter-search" class="activity-input" placeholder="Cari user, aksi, atau detail..." autocomplete="off" />
          </div>
        </div>
      </div>
      <div class="activity-filter-actions">
        <button class="btn btn-ghost" id="btn-reset-filter" style="font-size:0.82rem;padding:8px 14px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Reset
        </button>
        <button class="btn btn-ghost" id="btn-export-csv" style="font-size:0.82rem;padding:8px 14px;color:var(--emerald);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
        <button class="btn btn-ghost" id="btn-clear-logs" style="font-size:0.82rem;padding:8px 14px;color:var(--rose);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Hapus Semua
        </button>
      </div>
    </div>

    <!-- Log Table -->
    <div class="data-table activity-log-table animate-in" style="animation-delay:0.3s">
      <table>
        <thead>
          <tr>
            <th style="width:170px">Waktu</th>
            <th style="width:150px">User</th>
            <th style="width:180px">Aksi</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody id="activity-log-body">
          <tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted);">
            <div class="spinner" style="width:24px;height:24px;border-width:2px;margin:0 auto 8px;"></div>
            Memuat log...
          </td></tr>
        </tbody>
      </table>
      <div id="activity-empty-state" class="empty-state" style="display:none">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <h3>Belum ada aktivitas</h3>
        <p>Log aktivitas akan otomatis tercatat saat user melakukan aksi</p>
      </div>
    </div>

    <!-- Pagination -->
    <div class="activity-pagination" id="activity-pagination" style="display:none">
      <div class="activity-pagination-info" id="pagination-info">Menampilkan 0 dari 0</div>
      <div class="activity-pagination-btns">
        <button class="btn btn-ghost" id="btn-prev-page" disabled style="padding:8px 14px;font-size:0.82rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="m15 18-6-6 6-6"/></svg>
          Sebelumnya
        </button>
        <span id="page-indicator" style="font-size:0.82rem;color:var(--text-muted);font-weight:600;padding:0 8px;">1</span>
        <button class="btn btn-ghost" id="btn-next-page" style="padding:8px 14px;font-size:0.82rem;">
          Selanjutnya
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    </div>

    <!-- Clear Confirmation Modal -->
    <div id="clear-log-modal" class="activity-modal-overlay" style="display:none;">
      <div class="card animate-in" style="max-width:420px;text-align:center;padding:32px;">
        <div style="font-size:2.5rem;margin-bottom:12px;">🗑️</div>
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:8px;">Hapus Semua Log?</h3>
        <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:24px;">Semua riwayat aktivitas akan dihapus permanen dan tidak bisa dikembalikan.</p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button class="btn btn-ghost" id="btn-cancel-clear">Batal</button>
          <button class="btn" id="btn-confirm-clear" style="background:var(--rose);color:white;">Ya, Hapus Semua</button>
        </div>
      </div>
    </div>
  `;

  // --- Elements ---
  const tbody = container.querySelector('#activity-log-body');
  const emptyState = container.querySelector('#activity-empty-state');
  const pagination = container.querySelector('#activity-pagination');
  const paginationInfo = container.querySelector('#pagination-info');
  const pageIndicator = container.querySelector('#page-indicator');
  const btnPrev = container.querySelector('#btn-prev-page');
  const btnNext = container.querySelector('#btn-next-page');
  const filterAction = container.querySelector('#filter-action');
  const filterDateFrom = container.querySelector('#filter-date-from');
  const filterDateTo = container.querySelector('#filter-date-to');
  const filterSearch = container.querySelector('#filter-search');

  // --- Load Data ---
  async function loadData() {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted);">
      <div class="spinner" style="width:24px;height:24px;border-width:2px;margin:0 auto 8px;"></div>
      Memuat log...
    </td></tr>`;

    const { entries, total } = await getActivities(currentFilters);
    currentTotal = total;

    if (entries.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      pagination.style.display = 'none';
      const tableEl = container.querySelector('.activity-log-table table');
      if (tableEl) tableEl.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      const tableEl = container.querySelector('.activity-log-table table');
      if (tableEl) tableEl.style.display = '';
      tbody.innerHTML = entries.map(renderLogRow).join('');
      updatePagination();
    }
  }

  function renderLogRow(entry) {
    const actionInfo = ACTION_TYPES[entry.action] || { label: entry.action, icon: '📝', color: '#64748b' };
    const time = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(entry.timestamp));

    const detailParts = [];
    if (entry.details) {
      if (entry.details.employeeName) detailParts.push(`<strong>${entry.details.employeeName}</strong>`);
      if (entry.details.nik) detailParts.push(`NIK: ${entry.details.nik}`);
      if (entry.details.ticketId) detailParts.push(`Ticket: ${entry.details.ticketId}`);
      if (entry.details.username) detailParts.push(`User: <strong>${entry.details.username}</strong>`);
      if (entry.details.fullName) detailParts.push(`Nama: ${entry.details.fullName}`);
      if (entry.details.role) detailParts.push(`Role: ${entry.details.role}`);
      if (entry.details.info) detailParts.push(entry.details.info);
    }

    return `
      <tr class="activity-log-row">
        <td data-label="Waktu">
          <div class="activity-time">${time}</div>
        </td>
        <td data-label="User">
          <div class="activity-user">
            <span class="activity-user-avatar" style="background:${actionInfo.color}20;color:${actionInfo.color};">${(entry.user || '?').substring(0, 2).toUpperCase()}</span>
            <span class="activity-user-name">${entry.user || 'Unknown'}</span>
          </div>
        </td>
        <td data-label="Aksi">
          <span class="activity-action-badge" style="background:${actionInfo.color}12;color:${actionInfo.color};border:1px solid ${actionInfo.color}30;">
            <span>${actionInfo.icon}</span>
            ${actionInfo.label}
          </span>
        </td>
        <td data-label="Detail">
          <div class="activity-detail">${detailParts.join(' <span class="activity-detail-sep">•</span> ') || '<span style="color:var(--text-muted)">—</span>'}</div>
        </td>
      </tr>
    `;
  }

  function updatePagination() {
    const currentPage = Math.floor(currentFilters.offset / PAGE_SIZE) + 1;
    const totalPages = Math.ceil(currentTotal / PAGE_SIZE);

    if (totalPages <= 1) {
      pagination.style.display = 'none';
      return;
    }

    pagination.style.display = 'flex';
    const start = currentFilters.offset + 1;
    const end = Math.min(currentFilters.offset + PAGE_SIZE, currentTotal);
    paginationInfo.textContent = `Menampilkan ${start}–${end} dari ${currentTotal}`;
    pageIndicator.textContent = `${currentPage} / ${totalPages}`;
    btnPrev.disabled = currentPage <= 1;
    btnNext.disabled = currentPage >= totalPages;
  }

  // --- Event Handlers ---
  function applyFilters() {
    currentFilters.action = filterAction.value;
    currentFilters.dateFrom = filterDateFrom.value;
    currentFilters.dateTo = filterDateTo.value;
    currentFilters.offset = 0;
    loadData();
  }

  filterAction.addEventListener('change', applyFilters);
  filterDateFrom.addEventListener('change', applyFilters);
  filterDateTo.addEventListener('change', applyFilters);

  const handleSearch = debounce((val) => {
    currentFilters.search = val;
    currentFilters.offset = 0;
    loadData();
  }, 400);
  filterSearch.addEventListener('input', (e) => handleSearch(e.target.value));

  container.querySelector('#btn-reset-filter').addEventListener('click', () => {
    filterAction.value = 'ALL';
    filterDateFrom.value = '';
    filterDateTo.value = '';
    filterSearch.value = '';
    currentFilters = { action: 'ALL', dateFrom: '', dateTo: '', search: '', limit: PAGE_SIZE, offset: 0 };
    loadData();
  });

  btnPrev.addEventListener('click', () => {
    currentFilters.offset = Math.max(0, currentFilters.offset - PAGE_SIZE);
    loadData();
  });

  btnNext.addEventListener('click', () => {
    if (currentFilters.offset + PAGE_SIZE < currentTotal) {
      currentFilters.offset += PAGE_SIZE;
      loadData();
    }
  });

  // Export CSV
  container.querySelector('#btn-export-csv').addEventListener('click', async () => {
    const btn = container.querySelector('#btn-export-csv');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Exporting...';
    try {
      await exportActivitiesToCSV(currentFilters);
      showToast('Log berhasil di-export ke CSV', 'success');
    } catch (err) {
      showToast('Gagal export: ' + err.message, 'error');
    }
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export CSV';
  });

  // Clear logs
  const clearModal = container.querySelector('#clear-log-modal');
  container.querySelector('#btn-clear-logs').addEventListener('click', () => {
    clearModal.style.display = 'flex';
  });
  container.querySelector('#btn-cancel-clear').addEventListener('click', () => {
    clearModal.style.display = 'none';
  });
  container.querySelector('#btn-confirm-clear').addEventListener('click', async () => {
    await clearActivities();
    clearModal.style.display = 'none';
    showToast('Semua log berhasil dihapus', 'success');
    loadData();
    // Update stats
    const s = await getActivityStats();
    container.querySelectorAll('.stat-value')[0].textContent = s.total;
    container.querySelectorAll('.stat-value')[1].textContent = s.today;
    container.querySelectorAll('.stat-value')[2].textContent = s.thisWeek;
    container.querySelectorAll('.stat-value')[3].textContent = s.uniqueUsers;
  });

  // Initial load
  loadData();
}
