import { uploadGlobalLogo } from '../services/api.js';
import { setLogo, getLogo } from '../templates/idcard.js';
import { showToast } from '../utils/toast.js';
import { blobToDataURL } from '../utils/helpers.js';

export async function renderSettings(container) {
  const currentLogo = getLogo();

  container.innerHTML = `
    <div class="page-header animate-in">
      <h1>Settings</h1>
      <p>Pengaturan global aplikasi ID Card</p>
    </div>

    <div class="card animate-in delay-1" style="max-width: 600px; margin: 0 auto; margin-top: 2rem;">
      <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Logo Perusahaan</h3>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">
        Logo ini akan digunakan secara global pada semua cetakan ID Card. Hanya admin yang boleh mengubah pengaturan ini.
      </p>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div id="settings-logo-preview" style="display: ${currentLogo ? 'flex' : 'none'}; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 1px dashed var(--border); border-radius: 8px; padding: 2rem;">
          <img id="settings-logo-img" src="${currentLogo || ''}" style="max-height: 80px; object-fit: contain;"/>
        </div>

        <div>
          <label class="btn btn-primary" style="cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Pilih File Logo
            <input type="file" id="settings-logo-input" accept="image/*" style="display: none;"/>
          </label>
        </div>
      </div>
    </div>

    <div class="card animate-in delay-2" style="max-width: 600px; margin: 0 auto; margin-top: 2rem;">
      <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Uji Coba Notifikasi</h3>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">
        Gunakan tombol di bawah untuk menguji apakah notifikasi toast dan browser berjalan dengan baik. Jika status belum diizinkan, klik tombol untuk meminta akses (Always Allow).
      </p>

      <div style="margin-bottom: 1rem; font-size: 0.9rem;">
        Status Izin Browser: <span id="notif-status-badge" style="font-weight: bold; padding: 2px 8px; border-radius: 4px; background: var(--surface-light);">Memeriksa...</span>
      </div>

      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <button id="btn-test-toast" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Test Toast Notification
        </button>
        <button id="btn-test-browser" class="btn" style="background: var(--surface-light); color: var(--text); border: 1px solid var(--border); display: inline-flex; align-items: center; gap: 8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          Test Browser Notification
        </button>
      </div>
    </div>
  `;

  const logoInput = container.querySelector('#settings-logo-input');
  const preview = container.querySelector('#settings-logo-preview');
  const logoImg = container.querySelector('#settings-logo-img');

  logoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      showToast('File terlalu besar. Maksimum 2MB.', 'error');
      return;
    }

    const dataURL = await blobToDataURL(file);
    
    // Update local preview immediately
    setLogo(dataURL);
    logoImg.src = dataURL;
    preview.style.display = 'flex';
    
    showToast('Menyimpan konfigurasi logo ke server...', 'info');
    
    const success = await uploadGlobalLogo(dataURL);
    
    if (success) {
      showToast('Logo berhasil tersimpan secara permanen! Tersinkronisasi di semua perangkat.', 'success');
    } else {
      showToast('Gagal menyimpan ke server GLPI. Silakan periksa koneksi atau konfigurasi.', 'error');
    }
  });

  const btnTestToast = container.querySelector('#btn-test-toast');
  const btnTestBrowser = container.querySelector('#btn-test-browser');
  const statusBadge = container.querySelector('#notif-status-badge');

  function updateNotifStatus() {
    if (!('Notification' in window)) {
      statusBadge.textContent = 'Tidak Didukung';
      statusBadge.style.color = '#e11d48';
      return;
    }
    if (Notification.permission === 'granted') {
      statusBadge.textContent = 'Diizinkan (Always Allow)';
      statusBadge.style.color = '#10b981';
      statusBadge.style.background = 'rgba(16, 185, 129, 0.1)';
    } else if (Notification.permission === 'denied') {
      statusBadge.textContent = 'Ditolak (Block)';
      statusBadge.style.color = '#e11d48';
      statusBadge.style.background = 'rgba(225, 29, 72, 0.1)';
    } else {
      statusBadge.textContent = 'Belum Diizinkan (Default)';
      statusBadge.style.color = '#f59e0b';
      statusBadge.style.background = 'rgba(245, 158, 11, 0.1)';
    }
  }

  updateNotifStatus();

  function playTestSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1); 
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch(e) { }
  }

  btnTestToast.addEventListener('click', () => {
    playTestSound();
    showToast('Ini adalah pesan ujicoba toast notification!', 'info');
  });

  btnTestBrowser.addEventListener('click', () => {
    if (!('Notification' in window)) {
      showToast('Browser ini tidak mendukung notifikasi desktop.', 'error');
      return;
    }

    if (Notification.permission === 'granted') {
      playTestSound();
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification('IT OPS Solusiku', {
            body: 'Notifikasi PWA berjalan dengan baik!',
            icon: '/pwa-icon-512.png',
            badge: '/favicon.svg',
            vibrate: [200, 100, 200]
          });
        });
      } else {
        new Notification('IT OPS Solusiku', {
          body: 'Notifikasi browser berjalan dengan baik!',
          icon: '/pwa-icon-512.png'
        });
      }
      showToast('Notifikasi telah dikirim.', 'success');
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        updateNotifStatus();
        if (permission === 'granted') {
          playTestSound();
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => {
              reg.showNotification('IT OPS Solusiku', {
                body: 'Notifikasi PWA berhasil diizinkan (Always Allow)!',
                icon: '/pwa-icon-512.png',
                badge: '/favicon.svg',
                vibrate: [200, 100, 200]
              });
            });
          } else {
            new Notification('IT OPS Solusiku', {
              body: 'Notifikasi browser berhasil diizinkan (Always Allow)!',
              icon: '/pwa-icon-512.png'
            });
          }
          showToast('Notifikasi diizinkan.', 'success');
        } else {
          showToast('Izin notifikasi ditolak oleh pengguna.', 'warning');
        }
      });
    } else {
      showToast('Izin notifikasi sebelumnya telah ditolak. Silakan izinkan melalui pengaturan browser Anda.', 'error');
    }
  });
}
