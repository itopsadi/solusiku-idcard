import { registerRoute, initRouter, navigate } from './utils/router.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderDetail } from './screens/detail.js';
import { renderApproval } from './screens/approval.js';
import { renderSettings } from './screens/settings.js';
import { renderFinished } from './screens/finished.js';
import { renderLogin } from './screens/login.js';
import { logoutUser, fetchGlobalLogo, getStats, getEmployees } from './services/api.js';
import { setLogo } from './templates/idcard.js';
import { registerSW } from 'virtual:pwa-register';

// PWA Registration
try {
  const updateSW = registerSW({
    onNeedRefresh() {
      console.log('New content available, please refresh.');
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });
} catch (e) {
  console.warn('PWA registration failed or not supported in this environment.', e);
}

// Register routes
registerRoute('/', renderDashboard);
registerRoute('/detail/:id', renderDetail);
registerRoute('/approval/:id', renderApproval);
registerRoute('/settings', renderSettings);
registerRoute('/finished', renderFinished);
registerRoute('/login', renderLogin);

// Global UI Interceptors
function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const iconH = document.getElementById('icon-hamburger');
  const iconC = document.getElementById('icon-close');
  if (sidebar) sidebar.classList.add('open');
  if (backdrop) backdrop.classList.add('active');
  if (iconH) iconH.style.display = 'none';
  if (iconC) iconC.style.display = 'block';
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const iconH = document.getElementById('icon-hamburger');
  const iconC = document.getElementById('icon-close');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
  if (iconH) iconH.style.display = 'block';
  if (iconC) iconC.style.display = 'none';
}

document.addEventListener('click', (e) => {
  // Hamburger button
  if (e.target.closest('#btn-hamburger')) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
    return;
  }

  // Backdrop click closes sidebar
  if (e.target.closest('#sidebar-backdrop')) {
    closeSidebar();
    return;
  }

  // Auto-close sidebar when a nav link is tapped on mobile
  if (window.innerWidth <= 768 && e.target.closest('.nav-link')) {
    closeSidebar();
  }

  // Global Refresh Button (Top bar, Sidebar, or Mobile Nav)
  if (e.target.closest('#btn-refresh-global') || e.target.closest('#btn-refresh-sidebar') || e.target.closest('#btn-refresh-mobile')) {
    const btn = e.target.closest('#btn-refresh-global') || e.target.closest('#btn-refresh-sidebar') || e.target.closest('#btn-refresh-mobile');
    const icon = btn.querySelector('svg');
    const loadingOverlay = document.getElementById('global-loading');
    
    // Tampilkan loading di tengah layar
    if (loadingOverlay) {
      loadingOverlay.style.display = 'flex';
    }
    
    if (icon) icon.style.animation = 'spin 1s linear infinite';

    // Timeout safety: Tutup loading setelah 10 detik jika tidak selesai-selesai
    const timeout = setTimeout(() => {
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (icon) icon.style.animation = '';
    }, 10000);

    getEmployees(true).then(() => {
      clearTimeout(timeout);
      initRouter();
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (icon) icon.style.animation = '';
    }).catch(() => {
      clearTimeout(timeout);
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (icon) icon.style.animation = '';
    });
    return;
  }

  // Logout handling — full cache clear + hard reload
  if (e.target.closest('#btn-logout') || e.target.closest('#btn-logout-mobile')) {
    e.preventDefault();
    logoutUser();
    document.body.classList.add('logged-out');
    document.body.classList.remove('is-super-admin');
    
    // Clear ALL caches (Service Worker + Cache Storage)
    (async () => {
      try {
        // 1. Unregister all service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        }
        // 2. Delete all Cache Storage entries
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          for (const name of cacheNames) {
            await caches.delete(name);
          }
        }
      } catch (err) {
        console.warn('Cache clear failed:', err);
      }
      // 3. Hard reload to /login (bypasses all caches)
      window.location.href = window.location.pathname + '#/login';
      window.location.reload(true);
    })();
    return;
  }
});

// --- Pull to Refresh Logic ---
let touchStart = 0;
let pullDistance = 0;
const PULL_THRESHOLD = 80;

document.addEventListener('touchstart', (e) => {
  // Only track if at the top of the page
  if (window.scrollY === 0) {
    touchStart = e.touches[0].pageY;
  } else {
    touchStart = 0;
  }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (touchStart === 0) return;
  const touchCurrent = e.touches[0].pageY;
  pullDistance = touchCurrent - touchStart;

  if (pullDistance > 10) {
    const indicator = document.getElementById('pull-refresh-indicator');
    if (indicator) {
      indicator.style.display = 'flex';
      indicator.style.opacity = Math.min(pullDistance / PULL_THRESHOLD, 1);
      indicator.style.transform = `translateX(-50%) translateY(${Math.min(pullDistance/2, 40)}px)`;
      
      const label = indicator.querySelector('span');
      if (pullDistance > PULL_THRESHOLD) {
        label.textContent = 'Lepas untuk refresh...';
        indicator.style.backgroundColor = 'var(--accent)';
        label.style.color = 'white';
        indicator.querySelector('.spinner').style.borderColor = 'white';
        indicator.querySelector('.spinner').style.borderTopColor = 'transparent';
      } else {
        label.textContent = 'Tarik untuk refresh...';
        indicator.style.backgroundColor = 'var(--card-bg)';
        label.style.color = 'var(--text-main)';
        indicator.querySelector('.spinner').style.borderColor = 'var(--border-color)';
        indicator.querySelector('.spinner').style.borderTopColor = 'var(--accent)';
      }
    }
  }
}, { passive: true });

document.addEventListener('touchend', async () => {
  if (pullDistance > PULL_THRESHOLD) {
    const indicator = document.getElementById('pull-refresh-indicator');
    if (indicator) {
      indicator.querySelector('span').textContent = 'Refreshing...';
      indicator.querySelector('.spinner').style.animation = 'spin 1s linear infinite';
    }
    
    try {
      await getEmployees(true);
      initRouter();
    } catch (err) {}
    
    // Hide after a short delay
    setTimeout(() => {
      if (indicator) indicator.style.display = 'none';
    }, 500);
  } else {
    const indicator = document.getElementById('pull-refresh-indicator');
    if (indicator) indicator.style.display = 'none';
  }
  touchStart = 0;
  pullDistance = 0;
});

// --- Mobile Nav Active Sync ---
window.addEventListener('hashchange', () => {
  const hash = window.location.hash || '#/';
  const route = hash.replace('#', '');
  
  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-route') === route);
  });
});


// App Initialization
async function initApp() {
  const sessionToken = localStorage.getItem('solusiku_user_session') || sessionStorage.getItem('solusiku_user_session');
  
  if (sessionToken) {
    document.body.classList.remove('logged-out');
    
    // Paksa ambil data terbaru dari GLPI saat startup dan TUNGGU sampai selesai
    try {
      await getEmployees(true);
    } catch (e) {
      console.error('Initial data fetch failed:', e);
    }
    try {
      const pStr = localStorage.getItem('solusiku_user_profile') || sessionStorage.getItem('solusiku_user_profile');
      if (pStr) {
        const p = JSON.parse(pStr);
        const nameEl = document.querySelector('.user-name');
        const roleEl = document.querySelector('.user-role');
        const avatarEl = document.querySelector('.user-avatar');
        if (nameEl) nameEl.textContent = p.name;
        if (roleEl) roleEl.textContent = p.role;
        if (avatarEl) avatarEl.textContent = p.avatar;
        
        // Role-based UI: show/hide Settings for Super-Admin only
        const isSuperAdmin = (p.role || '').toLowerCase().includes('super-admin');
        if (isSuperAdmin) {
          document.body.classList.add('is-super-admin');
        } else {
          document.body.classList.remove('is-super-admin');
        }
      }
    } catch (e) {}

    try {
      const globalLogo = await fetchGlobalLogo();
      if (globalLogo) {
        setLogo(globalLogo);
      }
    } catch (err) {
      console.warn('Gagal memuat logo global:', err);
    }
  } else {
    document.body.classList.add('logged-out');
    window.location.hash = '/login';
  }

  initRouter();
}

// --- PWA Installation Logic ---
// --- PWA Installation Logic ---
let deferredPrompt;
const installContainer = document.getElementById('pwa-install-container');
const installBtn = document.getElementById('pwa-install-btn');
const globalBanner = document.getElementById('pwa-global-banner');
const bannerInstallBtn = document.getElementById('pwa-banner-install');
const bannerCloseBtn = document.getElementById('pwa-banner-close');
const iosInstruction = document.getElementById('ios-install-instruction');
const iosCloseBtn = document.getElementById('ios-instruction-close');

// Detect iOS
const isIos = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};
// Detect if running as PWA
const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

// Show iOS instruction if on iOS and not installed, and hasn't been dismissed
if (isIos() && !isInStandaloneMode() && !localStorage.getItem('ios_pwa_dismissed')) {
  if (iosInstruction) iosInstruction.style.display = 'block';
}

if (iosCloseBtn) {
  iosCloseBtn.addEventListener('click', () => {
    if (iosInstruction) iosInstruction.style.display = 'none';
    localStorage.setItem('ios_pwa_dismissed', 'true');
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  
  // Update UI notify the user they can install the PWA
  if (installContainer) installContainer.style.display = 'block'; // sidebar item
  
  // Show global floating banner if not previously dismissed
  if (globalBanner && !localStorage.getItem('pwa_banner_dismissed')) {
    globalBanner.style.display = 'flex';
  }
});

const handleInstallClick = async () => {
  if (!deferredPrompt) return;
  // Show the install prompt
  deferredPrompt.prompt();
  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`[PWA] User response to install prompt: ${outcome}`);
  // We've used the prompt, and can't use it again, throw it away
  deferredPrompt = null;
  // Hide the install UI
  if (installContainer) installContainer.style.display = 'none';
  if (globalBanner) globalBanner.style.display = 'none';
};

if (installBtn) installBtn.addEventListener('click', handleInstallClick);
if (bannerInstallBtn) bannerInstallBtn.addEventListener('click', handleInstallClick);

if (bannerCloseBtn) {
  bannerCloseBtn.addEventListener('click', () => {
    if (globalBanner) globalBanner.style.display = 'none';
    localStorage.setItem('pwa_banner_dismissed', 'true');
  });
}

window.addEventListener('appinstalled', () => {
  // Clear the deferredPrompt so it can be garbage collected
  deferredPrompt = null;
  // Hide the install UI
  if (installContainer) installContainer.style.display = 'none';
  if (globalBanner) globalBanner.style.display = 'none';
  console.log('[PWA] App was installed successfully');
});

// --- Polling & Notification Logic ---
let lastPendingCount = -1;

async function checkNotifications() {
  const sessionToken = localStorage.getItem('solusiku_user_session') || sessionStorage.getItem('solusiku_user_session');
  if (!sessionToken) return;

  try {
    const stats = await getStats();
    const currentPending = stats.pending || 0;
    
    // Update Sidebar Badge
    const badge = document.getElementById('nav-badge-pending');
    if (badge) {
      badge.textContent = currentPending;
      badge.style.display = currentPending > 0 ? 'inline-block' : 'none';
    }

    // Trigger Notification if count increased
    if (lastPendingCount !== -1 && currentPending > lastPendingCount) {
      if (Notification.permission === 'granted') {
        new Notification('IT OPS Solusiku', {
          body: `Ada ${currentPending - lastPendingCount} data baru menunggu foto!`,
          icon: '/favicon.svg'
        });
      }
    }
    lastPendingCount = currentPending;
  } catch (err) {
    console.error('Polling error:', err);
  }
}

// Request permission and start polling
if ('Notification' in window) {
  if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

// Check every 3 minutes (180000 ms)
setInterval(checkNotifications, 180000);
// Initial check
checkNotifications();

// ============================================================
// Global Error Boundary — catch crashes from WASM/AI models
// Prevents blank page when background-removal.js crashes
// ============================================================
window.addEventListener('unhandledrejection', (event) => {
  const err = event.reason;
  const msg = err?.message || String(err);
  console.error('[Global] Unhandled rejection:', msg);
  
  // Show toast if possible
  try {
    const { showToast } = window._toastModule || {};
    const container = document.getElementById('toast-container');
    if (container) {
      const toast = document.createElement('div');
      toast.className = 'toast toast-error';
      toast.textContent = '⚠️ Proses gagal: ' + (msg.length > 80 ? msg.slice(0, 80) + '...' : msg);
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    }
  } catch (e) {}

  // If page is blank (no visible content), navigate back to home
  const pageContainer = document.getElementById('page-container');
  if (pageContainer && !pageContainer.children.length) {
    window.location.hash = '/';
  }
});

window.addEventListener('error', (event) => {
  console.error('[Global] Uncaught error:', event.message, event.filename, event.lineno);
});

initApp();

console.log('%c🪪 ID Card Control Center', 'color:#b91c1c;font-size:14px;font-weight:bold');
console.log('%c   Solusiku IT Operations', 'color:#ef4444;font-size:11px');
