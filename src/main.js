import { registerRoute, initRouter, navigate } from './utils/router.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderDetail } from './screens/detail.js';
import { renderApproval } from './screens/approval.js';
import { renderSettings } from './screens/settings.js';
import { renderFinished } from './screens/finished.js';
import { renderLogin } from './screens/login.js';
import { renderUserMaker } from './screens/user-maker.js';
import { logoutUser, fetchGlobalLogo, getStats, getEmployees, resetAdminSessionCache } from './services/api.js';
import { setLogo } from './templates/idcard.js';
import { registerSW } from 'virtual:pwa-register';
import { showToast } from './utils/toast.js';

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
registerRoute('/user-maker', renderUserMaker);

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

  // Floating Corner Refresh Button Handler
  if (e.target.closest('#floating-refresh-btn')) {
    const btn = e.target.closest('#floating-refresh-btn');
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

    // Reset admin session cache agar data benar-benar segar dari GLPI
    resetAdminSessionCache();

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
    document.body.classList.remove('is-super-admin', 'is-technical');

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



// --- Mobile Nav Active Sync ---
window.addEventListener('hashchange', () => {
  const hash = window.location.hash || '#/';
  const route = hash.replace('#', '');

  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-route') === route);
  });

  if (window.checkAndShowGlobalBanner) {
    window.checkAndShowGlobalBanner();
  }
});


// App Initialization
async function initApp() {
  // --- FORCED LOGOUT ON NEW DEPLOYMENT ---
  // Cukup ubah nilai kunci ini (misalnya naikkan versi atau tanggal) untuk memaksa semua user ter-logout otomatis saat deployment baru aktif.
  const CURRENT_DEPLOYMENT_KEY = '20260526-v01';
  const savedKey = localStorage.getItem('solusiku_deployment_key');

  if (savedKey !== CURRENT_DEPLOYMENT_KEY) {
    console.log('[PWA] Versi baru terdeteksi. Melakukan logout paksa dan pembersihan cache...');

    // Bersihkan sesi & profil pengguna
    localStorage.removeItem('solusiku_user_session');
    sessionStorage.removeItem('solusiku_user_session');
    localStorage.removeItem('solusiku_user_profile');
    sessionStorage.removeItem('solusiku_user_profile');

    // Bersihkan seluruh Cache Storage PWA
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
    } catch (e) {
      console.warn('[PWA] Gagal membersihkan cache storage:', e);
    }

    // Simpan kunci deployment terbaru
    localStorage.setItem('solusiku_deployment_key', CURRENT_DEPLOYMENT_KEY);

    // Paksa reload halaman ke login
    window.location.hash = '/login';
    window.location.reload(true);
    return;
  }

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

        // Role-based UI: show/hide Settings & User Maker
        const r = (p.role || '').toLowerCase();
        const isSuperAdmin = r.includes('super-admin');
        const isTechnical = isSuperAdmin || r.includes('it operation') || r.includes('it ops') || r.includes('technician') || r.includes('technical') || r.includes('it op');

        if (isSuperAdmin) {
          document.body.classList.add('is-super-admin');
        } else {
          document.body.classList.remove('is-super-admin');
        }

        if (isTechnical) {
          document.body.classList.add('is-technical');
        } else {
          document.body.classList.remove('is-technical');
        }
      }
    } catch (e) { }

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
const globalBanner = document.getElementById('pwa-global-banner');
const bannerInstallBtn = document.getElementById('pwa-banner-install');
const bannerCloseBtn = document.getElementById('pwa-banner-close');

// Custom Modal Elements
const installModal = document.getElementById('pwa-install-modal');
const btnDownloadCrt = document.getElementById('btn-download-crt');
const step2Pwa = document.getElementById('step-2-pwa');
const step2Badge = document.getElementById('step-2-badge');
const instructionAndroid = document.getElementById('instruction-android');
const instructionIos = document.getElementById('instruction-ios');
const btnModalInstallPwa = document.getElementById('btn-install-pwa');
const btnCloseModal = document.getElementById('close-pwa-modal');
const iosCertHint = document.getElementById('ios-cert-hint');

// Detect Devices
const isIos = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};
const isInStandaloneMode = () => {
  return ('standalone' in window.navigator && window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches;
};

// Function to Show Custom Modal
window.showPwaInstallModal = function () {
  if (installModal) {
    installModal.style.display = 'flex';

    // Reset Step 2
    if (step2Pwa) {
      step2Pwa.style.opacity = '0.5';
      step2Pwa.style.pointerEvents = 'none';
    }
    if (step2Badge) {
      step2Badge.style.background = '#94a3b8';
    }

    // Platform specifics
    if (isIos()) {
      if (instructionIos) instructionIos.style.display = 'block';
      if (instructionAndroid) instructionAndroid.style.display = 'none';
      if (btnModalInstallPwa) btnModalInstallPwa.style.display = 'none';
      if (iosCertHint) iosCertHint.style.display = 'block';
    } else {
      if (instructionIos) instructionIos.style.display = 'none';
      if (instructionAndroid) instructionAndroid.style.display = 'block';
      if (iosCertHint) iosCertHint.style.display = 'none';

      if (deferredPrompt) {
        if (btnModalInstallPwa) btnModalInstallPwa.style.display = 'flex';
        if (instructionAndroid) instructionAndroid.innerHTML = "Klik tombol di bawah ini untuk menginstal aplikasi.";
      } else {
        if (btnModalInstallPwa) btnModalInstallPwa.style.display = 'none';
        if (instructionAndroid) instructionAndroid.innerHTML = "Browser Anda tidak mendukung instalasi otomatis, silahkan pilih <b>'Install App'</b> / <b>'Add to Home Screen'</b> dari menu browser (titik tiga).";
      }
    }
  }
}

// Sidebar & Global Banner triggers modal
if (installBtn) installBtn.addEventListener('click', window.showPwaInstallModal);

// Make the entire global banner clickable
if (globalBanner) {
  globalBanner.addEventListener('click', (e) => {
    // Do nothing if the close button was clicked
    if (e.target.closest('#pwa-banner-close')) return;
    window.showPwaInstallModal();
  });
}

if (bannerCloseBtn) {
  bannerCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent the banner click event from firing
    if (globalBanner) globalBanner.style.display = 'none';
    localStorage.setItem('pwa_banner_dismissed', 'true');
  });
}

// Modal Handlers
if (btnDownloadCrt) {
  btnDownloadCrt.addEventListener('click', () => {
    // Unlock Step 2 after clicking download
    setTimeout(() => {
      if (step2Pwa) {
        step2Pwa.style.opacity = '1';
        step2Pwa.style.pointerEvents = 'auto';
      }
      if (step2Badge) {
        step2Badge.style.background = 'var(--primary-color)';
      }
    }, 1000);
  });
}

if (btnModalInstallPwa) {
  btnModalInstallPwa.addEventListener('click', async () => {
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecure) {
      alert("PWA Gagal Diinstall: Koneksi tidak aman (HTTP). Browser memblokir instalasi PWA di luar HTTPS.");
      return;
    }

    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] User response to install prompt: ${outcome}`);
      if (outcome === 'accepted') {
        if (installModal) installModal.style.display = 'none';
        if (globalBanner) globalBanner.style.display = 'none';
      }
    } catch (e) {
      console.error(e);
      alert("Instalasi gagal: " + e.message);
    } finally {
      deferredPrompt = null;
    }
  });
}

if (btnCloseModal) {
  btnCloseModal.addEventListener('click', () => {
    if (installModal) installModal.style.display = 'none';
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  if (installContainer) installContainer.style.display = 'block';

  const hash = window.location.hash || '#/';
  if (globalBanner && !localStorage.getItem('pwa_banner_dismissed') && hash === '#/login') {
    globalBanner.style.display = 'flex';
  }
});

// Show global banner logic
window.checkAndShowGlobalBanner = function (forceShow = false) {
  if (!isInStandaloneMode()) {
    if (forceShow) {
      localStorage.removeItem('pwa_banner_dismissed');
    }
    const hash = window.location.hash || '#/';
    const banner = document.getElementById('pwa-global-banner');

    if (!localStorage.getItem('pwa_banner_dismissed') && hash === '#/login') {
      if (banner) banner.style.display = 'flex';
    } else {
      if (banner) banner.style.display = 'none';
    }
  }
};

// Initial check on load
window.checkAndShowGlobalBanner();

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  if (installContainer) installContainer.style.display = 'none';
  if (globalBanner) globalBanner.style.display = 'none';
  if (installModal) installModal.style.display = 'none';
  console.log('[PWA] App was installed successfully');
});

// --- Polling & Notification Logic ---
let lastStats = null;

async function checkNotifications() {
  const sessionToken = localStorage.getItem('solusiku_user_session') || sessionStorage.getItem('solusiku_user_session');
  if (!sessionToken) return;

  try {
    const stats = await getStats();

    // Update Sidebar Badge (menunggu foto)
    const badge = document.getElementById('nav-badge-pending');
    if (badge) {
      badge.textContent = stats.waiting;
      badge.style.display = stats.waiting > 0 ? 'inline-block' : 'none';
    }

    // Update Mobile Nav Badge (menunggu foto)
    let badgeMobile = document.getElementById('nav-badge-pending-mobile');
    if (!badgeMobile) {
      const homeLink = document.querySelector('.mobile-nav-link[data-route="/"]');
      if (homeLink) {
        homeLink.style.position = 'relative';
        badgeMobile = document.createElement('span');
        badgeMobile.id = 'nav-badge-pending-mobile';
        badgeMobile.style = 'display:none; position:absolute; top:4px; right:15%; background:var(--rose); color:white; font-size:0.6rem; font-weight:800; border-radius:10px; padding:1px 5px; min-width:16px; text-align:center; box-shadow:0 2px 4px rgba(225,29,72,0.4);';
        homeLink.appendChild(badgeMobile);
      }
    }

    if (badgeMobile) {
      badgeMobile.textContent = stats.waiting;
      badgeMobile.style.display = stats.waiting > 0 ? 'inline-block' : 'none';
    }

    // Update PWA App Icon Badge (jika disupport oleh browser/OS)
    if ('setAppBadge' in navigator) {
      if (stats.waiting > 0) {
        navigator.setAppBadge(stats.waiting).catch(console.error);
      } else {
        navigator.clearAppBadge().catch(console.error);
      }
    }

    // Trigger Notification if count increased
    if (lastStats !== null) {
      let msgs = [];

      // Jika ada tiket baru masuk (menunggu foto)
      if (stats.waiting > lastStats.waiting) {
        msgs.push(`Ada ${stats.waiting - lastStats.waiting} data baru menunggu foto!`);
      }

      // Jika ada tiket yang baru saja selesai diproses/diapprove technician
      if (stats.approved > lastStats.approved) {
        msgs.push(`Ada ${stats.approved - lastStats.approved} ID Card baru saja selesai diproses!`);
      }

      if (msgs.length > 0) {
        const msg = msgs.join('\\n');

        // Play Sound
        playNotificationSound();

        // Toast notification (in-app)
        showToast(msg, 'info');

        // Browser/PWA notification (system-level)
        if (Notification.permission === 'granted') {
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => {
              reg.showNotification('IT OPS Solusiku', {
                body: msg,
                icon: '/pwa-icon-512.png',
                badge: '/favicon.svg',
                vibrate: [200, 100, 200]
              });
            });
          } else {
            const notif = new Notification('IT OPS Solusiku', {
              body: msg,
              icon: '/pwa-icon-512.png'
            });
            notif.onclick = function () {
              window.focus();
              this.close();
            };
          }
        }
      }
    } else if (stats.waiting > 0) {
      // First load with pending items
      if (Notification.permission === 'granted') {
        const msg = `Ada ${stats.waiting} data yang menunggu untuk diproses.`;
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('IT OPS Solusiku', {
              body: msg,
              icon: '/pwa-icon-512.png',
              badge: '/favicon.svg',
              vibrate: [200, 100, 200]
            });
          });
        } else {
          const notif = new Notification('IT OPS Solusiku', {
            body: msg,
            icon: '/pwa-icon-512.png'
          });
          notif.onclick = function () {
            window.focus();
            this.close();
          };
        }
      }
    }
    lastStats = { ...stats };
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

// Check every 30 seconds (30000 ms)
setInterval(checkNotifications, 30000);
// Initial check
checkNotifications();

// --- Notification Sound Function ---
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Suara "Ting" (Ping notification)
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
    oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1); // Drop to A4

    // Volume envelope
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    console.warn("AudioContext not supported or blocked", e);
  }
}

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
  } catch (e) { }

  // If page is blank (no visible content), navigate back to home
  const pageContainer = document.getElementById('page-container');
  if (pageContainer && !pageContainer.children.length) {
    window.location.hash = '/';
  }
});

// --- Mobile PWA Horizontal Swipe Route Navigation ---
let swipeStartX = 0;
let swipeStartY = 0;

document.addEventListener('touchstart', (e) => {
  if (window.innerWidth > 768) return; // Only mobile PWA viewports
  const sessionToken = localStorage.getItem('solusiku_user_session') || sessionStorage.getItem('solusiku_user_session');
  if (!sessionToken) return; // Only logged-in users

  // Don't trigger if swiping inside custom scrollable components, crop tools, or sliders
  if (e.target.closest('.cropper-container') || e.target.closest('.slider') || e.target.closest('.pan-container') || e.target.closest('.modal-content') || e.target.closest('#user-modal-backdrop') || e.target.closest('#creds-modal-backdrop')) {
    return;
  }

  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  if (window.innerWidth > 768) return;
  const sessionToken = localStorage.getItem('solusiku_user_session') || sessionStorage.getItem('solusiku_user_session');
  if (!sessionToken) return;

  if (swipeStartX === 0 || swipeStartY === 0) return;

  const endX = e.changedTouches[0].clientX;
  const endY = e.changedTouches[0].clientY;

  const dX = endX - swipeStartX;
  const dY = endY - swipeStartY;

  // Reset coordinates
  swipeStartX = 0;
  swipeStartY = 0;

  // Ensure movement is mostly horizontal with a safe threshold
  if (Math.abs(dX) < 80 || Math.abs(dY) > 50) return;

  // Get current active visible navigation links with data-route
  const visibleLinks = Array.from(document.querySelectorAll('.mobile-nav-link[data-route]'))
    .filter(link => window.getComputedStyle(link).display !== 'none');

  if (visibleLinks.length <= 1) return;

  const hash = window.location.hash || '#/';
  const currentRoute = hash.replace('#', '');

  const currentIndex = visibleLinks.findIndex(link => link.getAttribute('data-route') === currentRoute);
  if (currentIndex === -1) return; // Not on a main navigation tab

  if (dX < 0) {
    // Swiped Left -> Move to Next Tab (Right)
    const nextIndex = currentIndex + 1;
    if (nextIndex < visibleLinks.length) {
      const nextRoute = visibleLinks[nextIndex].getAttribute('data-route');
      window.location.hash = '#' + nextRoute;
    }
  } else {
    // Swiped Right -> Move to Previous Tab (Left)
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      const prevRoute = visibleLinks[prevIndex].getAttribute('data-route');
      window.location.hash = '#' + prevRoute;
    }
  }
});

initApp();

console.log('%c🪪 ID Card Control Center', 'color:#b91c1c;font-size:14px;font-weight:bold');
console.log('%c   Solusiku IT Operations', 'color:#ef4444;font-size:11px');
