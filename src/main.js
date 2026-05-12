import { registerRoute, initRouter } from './utils/router.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderDetail } from './screens/detail.js';
import { renderApproval } from './screens/approval.js';
import { renderSettings } from './screens/settings.js';
import { renderFinished } from './screens/finished.js';
import { renderLogin } from './screens/login.js';
import { logoutUser, fetchGlobalLogo } from './services/api.js';
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

initApp();

console.log('%c🪪 ID Card Control Center', 'color:#6366f1;font-size:14px;font-weight:bold');
console.log('%c   Solusiku IT Operations', 'color:#06b6d4;font-size:11px');
