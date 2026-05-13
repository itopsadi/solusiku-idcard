import { registerRoute, initRouter } from './utils/router.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderDetail } from './screens/detail.js';
import { renderApproval } from './screens/approval.js';
import { renderSettings } from './screens/settings.js';
import { renderFinished } from './screens/finished.js';
import { renderLogin } from './screens/login.js';
import { logoutUser, fetchGlobalLogo, getStats } from './services/api.js';
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

  // Logout handling
  if (e.target.closest('#btn-logout')) {
    e.preventDefault();
    logoutUser();
    document.body.classList.add('logged-out');
    window.location.hash = '/login';
  }
});

// App Initialization
async function initApp() {
  const sessionToken = localStorage.getItem('solusiku_user_session') || sessionStorage.getItem('solusiku_user_session');
  
  if (sessionToken) {
    document.body.classList.remove('logged-out');
    
    // Tampilkan profil pengguna
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
let deferredPrompt;
const installContainer = document.getElementById('pwa-install-container');
const installBtn = document.getElementById('pwa-install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Update UI notify the user they can install the PWA
  if (installContainer) {
    installContainer.style.display = 'block';
  }
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response to install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt = null;
    // Hide the install button
    if (installContainer) {
      installContainer.style.display = 'none';
    }
  });
}

window.addEventListener('appinstalled', () => {
  // Clear the deferredPrompt so it can be garbage collected
  deferredPrompt = null;
  // Hide the install button
  if (installContainer) {
    installContainer.style.display = 'none';
  }
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

initApp();

console.log('%c🪪 ID Card Control Center', 'color:#b91c1c;font-size:14px;font-weight:bold');
console.log('%c   Solusiku IT Operations', 'color:#ef4444;font-size:11px');
