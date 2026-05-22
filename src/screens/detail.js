import { getEmployee, savePhoto, saveProcessedPhoto } from '../services/api.js';
import { initCamera, capturePhoto, switchCamera, stopCamera, isCameraSupported, getCurrentFacing } from '../services/camera.js';
// currentFacing is accessed via getCurrentFacing()
import { removeBackground } from '../services/background-removal.js';
import { triggerWebhook } from '../services/webhook.js';
import { statusBadge, formatDate, blobToDataURL, getTicketUrl } from '../utils/helpers.js';
import { navigate, goBack } from '../utils/router.js';
import { showToast } from '../utils/toast.js';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.min.css';

let cropperInstance = null;

export async function renderDetail(container, empId) {
  const emp = await getEmployee(empId);
  if (!emp) {
    container.innerHTML = `<div class="empty-state"><h3>Karyawan tidak ditemukan</h3></div>`;
    return;
  }

  const hasCamera = isCameraSupported();

  container.innerHTML = `
    <button class="back-btn" id="btn-back">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
      Kembali ke Dashboard
    </button>

    <div class="page-header">
      <h1>Detail Karyawan</h1>
      <p>Pengambilan & Pemrosesan Foto ID Card</p>
    </div>

    <div class="detail-grid">
      <!-- Left: Employee Info -->
      <div>
        <div class="card animate-in">
          <div class="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Data Karyawan
          </div>
          <div class="info-row"><span class="info-label">Nama Lengkap</span><span class="info-value">${emp.name}</span></div>
          <div class="info-row"><span class="info-label">Jabatan</span><span class="info-value">${emp.jabatan}</span></div>
          <div class="info-row"><span class="info-label">NIK</span><span class="info-value">${emp.nik}</span></div>
          <div class="info-row"><span class="info-label">Departemen</span><span class="info-value">${emp.department}</span></div>
          <div class="info-row"><span class="info-label">Ticket GLPI</span>
            <span class="info-value">
              <a href="${getTicketUrl(emp.ticketId)}" target="_blank" class="ticket-link-detail">
                ${emp.ticketId}
              </a>
            </span>
          </div>
          <div class="info-row"><span class="info-label">Status</span>${statusBadge(emp.status)}</div>
          <div class="info-row"><span class="info-label">Tanggal</span><span class="info-value" style="font-size:0.82rem">${formatDate(emp.createdAt)}</span></div>
        </div>
      </div>

      <!-- Right: Camera / Upload -->
      <div>
        <div class="card animate-in delay-1">
          <div class="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            Ambil Foto
          </div>

          <!-- Tabs -->
          <div class="tabs">
            <button class="tab-btn ${hasCamera ? 'active' : ''}" data-tab="camera" ${!hasCamera ? 'disabled' : ''}>📷 Kamera</button>
            <button class="tab-btn ${!hasCamera ? 'active' : ''}" data-tab="upload">📁 Upload File</button>
          </div>

          <!-- Camera Tab -->
          <div id="tab-camera" class="tab-content" style="display:${hasCamera ? 'block' : 'none'}">
            <div class="camera-container" id="camera-box" style="position:relative; background:#000; border-radius:var(--radius-md); overflow:hidden; aspect-ratio:9/16; max-height:65vh; margin:0 auto;">
              <video id="camera-video" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover; display:block;"></video>
              <div class="camera-overlay" style="position:absolute;inset:0;pointer-events:none;"><div class="camera-guide"></div></div>
              <div id="camera-label" style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.5);color:#fff;font-size:0.75rem;padding:4px 12px;border-radius:999px;">📷 Kamera Belakang</div>
            </div>
            <div class="camera-controls">
              <button class="btn-camera-switch" id="btn-switch" title="Switch Camera">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/><path d="m7 15 3 3 3-3"/><path d="m17 9-3-3-3 3"/></svg>
              </button>
              <button class="btn-capture" id="btn-capture" title="Ambil Foto"></button>
              <div style="width:44px"></div>
            </div>
          </div>

          <!-- Upload Tab -->
          <div id="tab-upload" class="tab-content" style="display:${hasCamera ? 'none' : 'block'}">
            <div class="upload-zone" id="upload-zone">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p>Drag & drop foto, atau klik untuk memilih file</p>
              <p class="upload-hint">Format: JPG, PNG (Max 10MB)</p>
              <input type="file" id="file-input" accept="image/*" style="display:none"/>
            </div>
          </div>

          <!-- Processing State -->
          <div id="processing-state" style="display:none">
            <div class="loading-spinner">
              <div class="spinner"></div>
              <div class="loading-text" id="processing-text">Menghapus background...</div>
              <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Crop Modal -->
    <div id="crop-modal" class="modal-overlay" style="display:none">
      <div class="modal">
        <div class="modal-header">
          <h2>Crop Foto</h2>
          <button class="modal-close" id="btn-crop-cancel">✕</button>
        </div>
        <div class="crop-container">
          <img id="crop-image" src="" alt="Crop"/>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="btn-crop-cancel2">Batal</button>
          <button class="btn btn-primary" id="btn-crop-confirm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polyline points="20 6 9 17 4 12"/></svg>
            Konfirmasi Crop
          </button>
        </div>
      </div>
    </div>
  `;

  // === Event Handlers ===
  const videoEl = container.querySelector('#camera-video');
  let cameraActive = false;

  // Back button
  container.querySelector('#btn-back').addEventListener('click', () => goBack('/'));

  // Tab switching
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      container.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
      container.querySelector(`#tab-${btn.dataset.tab}`).style.display = 'block';

      if (btn.dataset.tab === 'camera' && !cameraActive) {
        startCamera();
      } else if (btn.dataset.tab === 'upload') {
        stopCamera();
        cameraActive = false;
      }
    });
  });

  // Start camera if tab is active
  async function startCamera() {
    const ok = await initCamera(videoEl);
    cameraActive = ok;
    if (!ok) showToast('Tidak dapat mengakses kamera', 'error');
  }

  if (hasCamera) startCamera();

  // Capture
  container.querySelector('#btn-capture').addEventListener('click', () => {
    if (!cameraActive) return;
    const dataURL = capturePhoto(videoEl);
    openCropper(dataURL);
  });

  // Switch camera
  container.querySelector('#btn-switch').addEventListener('click', async () => {
    await switchCamera(videoEl);
    const label = container.querySelector('#camera-label');
    if (label) {
      const isFront = getCurrentFacing() === 'user';
      label.textContent = isFront ? '🤳 Kamera Depan' : '📷 Kamera Belakang';
    }
  });

  // Upload zone
  const uploadZone = container.querySelector('#upload-zone');
  const fileInput = container.querySelector('#file-input');

  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  async function handleFile(file) {
    const dataURL = await blobToDataURL(file);
    openCropper(dataURL);
  }

  // Cropper
  function openCropper(dataURL) {
    const modal = container.querySelector('#crop-modal');
    const cropImg = container.querySelector('#crop-image');
    modal.style.display = 'flex';
    cropImg.src = dataURL;

    if (cropperInstance) cropperInstance.destroy();

    cropperInstance = new Cropper(cropImg, {
      aspectRatio: 3 / 4,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.85,
      responsive: true,
      guides: true,
      ready() {
        // Add visual guide for antigravity effect positioning
        const cropBox = document.querySelector('.cropper-crop-box');
        if (cropBox && !document.querySelector('.cropper-id-guide')) {
          const guide = document.createElement('div');
          guide.className = 'cropper-id-guide';
          guide.innerHTML = `
            <svg viewBox="0 0 300 400" width="100%" height="100%" style="opacity:1; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));">
              <!-- Darken the outside of the ID card boundary for better focus -->
              <path d="M0 0 H300 V400 H0 Z" fill="rgba(0,0,0,0.2)"/>
              
              <!-- Realistic Gray Circle representing the actual ID Card template circle -->
              <!-- The circle is ~246px diameter (r=123), centered at X=150, bottom touches Y=406 -> cy=283 -->
              <circle cx="150" cy="283" r="123" fill="#f1f5f9" fill-opacity="0.4" stroke="#4f46e5" stroke-width="3" stroke-dasharray="8 4"/>
              
              <!-- Anti-gravity popping zone (Top area) -->
              <path d="M50 283 Q150 70 250 283" fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 4" opacity="0.8"/>
              
              <!-- Labels -->
              <rect x="75" y="270" width="150" height="26" rx="4" fill="rgba(0,0,0,0.6)"/>
              <text x="150" y="288" fill="#fff" font-size="14" font-weight="bold" font-family="sans-serif" text-anchor="middle">Lingkaran Abu-abu</text>
              
              <rect x="70" y="100" width="160" height="26" rx="4" fill="rgba(239,68,68,0.8)"/>
              <text x="150" y="118" fill="#fff" font-size="13" font-weight="bold" font-family="sans-serif" text-anchor="middle">Batas Kepala (Menyembul)</text>
            </svg>
          `;
          guide.style.position = 'absolute';
          guide.style.top = '0';
          guide.style.left = '0';
          guide.style.right = '0';
          guide.style.bottom = '0';
          guide.style.pointerEvents = 'none';
          guide.style.zIndex = '999';
          cropBox.appendChild(guide);
        }
      }
    });
  }

  function closeCropper() {
    const modal = container.querySelector('#crop-modal');
    modal.style.display = 'none';
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }
  }

  container.querySelector('#btn-crop-cancel').addEventListener('click', closeCropper);
  container.querySelector('#btn-crop-cancel2').addEventListener('click', closeCropper);

  container.querySelector('#btn-crop-confirm').addEventListener('click', async () => {
    if (!cropperInstance) return;
    const canvas = cropperInstance.getCroppedCanvas({ width: 600, height: 800, imageSmoothingQuality: 'high' });
    const croppedURL = canvas.toDataURL('image/png', 1.0);

    closeCropper();
    stopCamera();
    cameraActive = false;

    // Save photo
    savePhoto(empId, croppedURL);
    showToast('Foto berhasil diambil! Memproses...', 'success');

    // Trigger webhook
    triggerWebhook('photo_uploaded', { employeeId: empId, name: emp.name });

    // Show processing
    const processingEl = container.querySelector('#processing-state');
    container.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    container.querySelectorAll('.tabs').forEach(t => t.style.display = 'none');
    processingEl.style.display = 'block';

    // Small delay to let browser render the loading state
    await new Promise(r => setTimeout(r, 100));

    // Process background removal
    const progressFill = container.querySelector('#progress-fill');
    const processText = container.querySelector('#processing-text');

    try {
      const processedURL = await removeBackground(croppedURL, (p) => {
        progressFill.style.width = `${p}%`;
        if (p < 30) processText.textContent = 'Menganalisis foto...';
        else if (p < 70) processText.textContent = 'Menghapus background...';
        else if (p < 95) processText.textContent = 'Finishing touches...';
        else processText.textContent = 'Selesai!';
      });

      saveProcessedPhoto(empId, processedURL);
      showToast('Background berhasil dihapus!', 'success');

      setTimeout(() => navigate(`/approval/${empId}`), 800);
    } catch (err) {
      showToast('Gagal memproses foto: ' + err.message, 'error');
      saveProcessedPhoto(empId, croppedURL);
      setTimeout(() => navigate(`/approval/${empId}`), 800);
    }
  });

  // Cleanup function
  return () => {
    stopCamera();
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }
  };
}
