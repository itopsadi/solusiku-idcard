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
}
