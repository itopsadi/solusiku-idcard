import { getEmployee, approveEmployee, resetEmployee, uploadToGLPI, updateEmployee } from '../services/api.js';
import { exportToImage, downloadFile } from '../services/export.js';
import { triggerWebhook } from '../services/webhook.js';
import { renderIDCard } from '../templates/idcard.js';
import { navigate } from '../utils/router.js';
import { showToast } from '../utils/toast.js';
import { formatDate, getTicketUrl } from '../utils/helpers.js';

export async function renderApproval(container, empId) {
  const emp = await getEmployee(empId);
  if (!emp) {
    container.innerHTML = `<div class="empty-state"><h3>Karyawan tidak ditemukan</h3></div>`;
    return;
  }

  const photoToUse = emp.processedPhoto || emp.photo;

  container.innerHTML = `
    <button class="back-btn" id="btn-back">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
      Kembali ke Dashboard
    </button>

    <div class="page-header">
      <h1>Preview & Approval</h1>
      <p>Review hasil ID Card sebelum dicetak</p>
    </div>

    <div class="approval-layout">
      <!-- Comparison Toggle -->
      ${emp.photo && emp.processedPhoto ? `
      <div class="comparison-toggle">
        <button class="active" data-view="card">🪪 ID Card</button>
        <button data-view="original">📷 Foto Original</button>
        <button data-view="processed">✨ Foto Processed</button>
      </div>
      ` : ''}

      <!-- ID Card Preview -->
      <div class="idcard-preview-wrapper">
        <div class="idcard-preview-frame">
          <div id="idcard-render"></div>
        </div>
      </div>

      <!-- Photo Comparison (hidden by default) -->
      <div id="photo-comparison" style="display:none">
        <div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap">
          ${emp.photo ? `
          <div style="text-align:center">
            <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:8px">Original</p>
            <img src="${emp.photo}" alt="Original" style="width:200px;height:267px;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--border)"/>
          </div>` : ''}
          ${emp.processedPhoto ? `
          <div style="text-align:center">
            <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:8px">Processed</p>
            <img src="${emp.processedPhoto}" alt="Processed" style="width:200px;height:267px;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--border);background:repeating-conic-gradient(#e2e8f0 0% 25%, white 0% 50%) 50%/16px 16px"/>
          </div>` : ''}
        </div>
      </div>

      <!-- Info -->
      <div class="card" style="width:100%;max-width:500px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:0.85rem">
          <div><span class="info-label">Nama</span><br/><strong>${emp.name}</strong></div>
          <div><span class="info-label">Jabatan</span><br/><strong>${emp.jabatan}</strong></div>
          <div><span class="info-label">NIK</span><br/><strong>${emp.nik}</strong></div>
          <div><span class="info-label">Ticket</span><br/>
            <a href="${getTicketUrl(emp.ticketId)}" target="_blank" class="ticket-link-detail">
              <strong>${emp.ticketId}</strong>
            </a>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="approval-actions">
        ${emp.status !== 'approved' ? `
        <button class="btn btn-danger btn-lg" id="btn-reject">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="m15 9-6 6"/></svg>
          Retake Foto
        </button>
        <button class="btn btn-success btn-lg" id="btn-approve">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polyline points="20 6 9 17 4 12"/></svg>
          Approve & Print
        </button>
        ` : ''}
        <button class="btn btn-primary btn-lg" id="btn-download" ${emp.status === 'approved' ? 'style="grid-column: 1 / -1"' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download PNG
        </button>
      </div>
    </div>
  `;

  // Render ID Card
  const idcardEl = container.querySelector('#idcard-render');
  const card = renderIDCard({
    name: emp.name,
    jabatan: emp.jabatan,
    nik: emp.nik,
    photo: photoToUse,
  });
  idcardEl.appendChild(card);

  // --- Photo Panning Logic ---
  const photoWrapper = card.querySelector('.idcard-photo-wrapper');
  if (photoWrapper && photoToUse) {
    photoWrapper.style.cursor = 'grab';
    photoWrapper.title = 'Geser foto untuk menyesuaikan posisi';
    
    let isDragging = false;
    let startX = 0, startY = 0;
    let currentX = emp.panX || 0;
    let currentY = emp.panY || 0;
    
    const clipDiv = photoWrapper.querySelector('.idcard-photo-clip');
    const popDiv = photoWrapper.querySelector('.idcard-photo-pop');

    function applyPan() {
      // Use calc to shift background position from bottom center (50% 100%)
      const bgPos = `calc(50% + ${currentX}px) calc(100% + ${currentY}px)`;
      if (clipDiv) clipDiv.style.backgroundPosition = bgPos;
      if (popDiv) popDiv.style.backgroundPosition = bgPos;
    }
    
    // Apply initial saved position
    applyPan();

    function onDragStart(e) {
      if (e.target.closest('button')) return;
      isDragging = true;
      photoWrapper.style.cursor = 'grabbing';
      const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
      startX = clientX - currentX;
      startY = clientY - currentY;
      e.preventDefault(); // Prevent default image drag behavior
    }

    function onDragMove(e) {
      if (!isDragging) return;
      const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
      currentX = clientX - startX;
      currentY = clientY - startY;
      applyPan();
    }

    function onDragEnd() {
      if (!isDragging) return;
      isDragging = false;
      photoWrapper.style.cursor = 'grab';
      // Save position to employee data so it persists
      updateEmployee(empId, { panX: currentX, panY: currentY });
    }

    photoWrapper.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    
    photoWrapper.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
    
    // Cleanup event listeners when navigating away
    const cleanup = () => {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('touchend', onDragEnd);
    };
    
    // Override back button to cleanup
    const btnBack = container.querySelector('#btn-back');
    const oldBack = btnBack.onclick;
    btnBack.addEventListener('click', () => {
      cleanup();
    });
  }

  // Comparison toggle
  container.querySelectorAll('.comparison-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.comparison-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      const wrapper = container.querySelector('.idcard-preview-wrapper');
      const comparison = container.querySelector('#photo-comparison');

      if (view === 'card') {
        wrapper.style.display = 'block';
        comparison.style.display = 'none';
      } else {
        wrapper.style.display = 'none';
        comparison.style.display = 'block';
      }
    });
  });

  // Back
  container.querySelector('#btn-back').addEventListener('click', () => {
    if (emp.status === 'approved') {
      navigate('/finished');
    } else {
      navigate('/');
    }
  });

  // Reject (Only if not approved)
  if (emp.status !== 'approved') {
    container.querySelector('#btn-reject').addEventListener('click', () => {
      resetEmployee(empId);
      showToast('Foto direset. Silakan ambil ulang.', 'warning');
      navigate(`/detail/${empId}`);
    });
  }

  // Download
  container.querySelector('#btn-download').addEventListener('click', async () => {
    const btn = container.querySelector('#btn-download');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Exporting...';

    try {
      const { blob, width, height } = await exportToImage(card, 300);
      const filename = `IDCard_${emp.name.replace(/\s+/g, '_')}_${emp.nik}.png`;
      downloadFile(blob, filename);
      showToast(`Exported: ${width}×${height}px (300 DPI)`, 'success');
    } catch (err) {
      showToast('Export gagal: ' + err.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download PNG`;
  });

  // Approve (Only if not approved)
  if (emp.status !== 'approved') {
    container.querySelector('#btn-approve').addEventListener('click', async () => {
      const btn = container.querySelector('#btn-approve');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Processing...';

      try {
        const { blob } = await exportToImage(card, 300);
        approveEmployee(empId);
        
        const uploadSuccess = await uploadToGLPI(emp.ticketId, blob);
        if (uploadSuccess) {
          showToast('Berhasil sinkronisasi dengan GLPI', 'success');
        }

        await triggerWebhook('card_approved', {
          employeeId: empId,
          name: emp.name,
          nik: emp.nik,
          ticketId: emp.ticketId,
        });

        navigate('/finished');
      } catch (err) {
        showToast('Terjadi kesalahan: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polyline points="20 6 9 17 4 12"/></svg> Approve & Print`;
      }
    });
  }
}
