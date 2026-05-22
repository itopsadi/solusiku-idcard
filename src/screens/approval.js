import { getEmployee, approveEmployee, resetEmployee, uploadToGLPI, updateEmployee, fetchIDCardBlobURL } from '../services/api.js';
import { exportToImage, downloadFile } from '../services/export.js';
import { triggerWebhook } from '../services/webhook.js';
import { renderIDCard, getLogo } from '../templates/idcard.js';
import { navigate, goBack } from '../utils/router.js';
import { showToast } from '../utils/toast.js';
import { formatDate, getTicketUrl } from '../utils/helpers.js';

export async function renderApproval(container, empId) {
  const emp = await getEmployee(empId);
  if (!emp) {
    container.innerHTML = `<div class="empty-state"><h3>Karyawan tidak ditemukan</h3></div>`;
    return;
  }

  const isApproved = emp.status === 'approved';
  const photoToUse  = emp.processedPhoto || emp.photo;

  // ─── Declare ALL mutable state at the TOP — no TDZ issues ───
  var cardEl    = null;   // The rendered CSS ID card element (non-approved)
  var glpiBlob  = null;   // Cached blob from GLPI (approved)
  var glpiURL   = null;   // Cached object URL from GLPI (approved)

  // ──────────────────────────────────────────────────────────────
  // HTML SHELL
  // ──────────────────────────────────────────────────────────────
  container.innerHTML = `
    <button class="back-btn" id="btn-back">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
      ${isApproved ? 'Kembali ke Selesai' : 'Kembali ke Dashboard'}
    </button>

    <div class="page-header">
      <h1>${isApproved ? '✅ ID Card Selesai' : 'Preview &amp; Approval'}</h1>
      <p>${isApproved ? 'ID Card telah disetujui — ditampilkan langsung dari GLPI' : 'Review hasil ID Card sebelum dicetak'}</p>
    </div>

    <div class="approval-layout">
      ${!isApproved && emp.photo && emp.processedPhoto ? `
      <div class="comparison-toggle">
        <button class="active" data-view="card">🪪 ID Card</button>
        <button data-view="original">📷 Foto Original</button>
        <button data-view="processed">✨ Foto Processed</button>
      </div>` : ''}

      <!-- ID Card Preview -->
      <div class="idcard-preview-wrapper-v3" style="width:100%;display:grid;place-items:center;padding:20px 0;overflow:visible;min-height:350px;">
        <div class="idcard-preview-scale-container-v3" style="display:grid;place-items:center;transform-origin:center center;transition:transform 0.2s ease;">
          <div class="idcard-preview-frame-v3" style="width:324px;height:514px;position:relative;box-shadow:0 25px 70px rgba(0,0,0,0.22);border-radius:12px;background:#f5f5f5;overflow:hidden;flex-shrink:0;">
            <div id="idcard-render" style="position:absolute;inset:0;"></div>
          </div>
        </div>
      </div>

      <!-- Photo Comparison (pending only) -->
      <div id="photo-comparison" style="display:none;width:100%;">
        <div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap;padding:20px 0">
          ${emp.photo ? `<div style="text-align:center">
            <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:8px">Original</p>
            <img src="${emp.photo}" alt="Original" style="width:200px;height:267px;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--border)"/>
          </div>` : ''}
          ${emp.processedPhoto ? `<div style="text-align:center">
            <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:8px">Processed</p>
            <img src="${emp.processedPhoto}" alt="Processed" style="width:200px;height:267px;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--border);background:repeating-conic-gradient(#e2e8f0 0% 25%,white 0% 50%) 50%/16px 16px"/>
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
            <a href="${getTicketUrl(emp.ticketId)}" target="_blank" class="ticket-link-detail"><strong>${emp.ticketId}</strong></a>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="approval-actions">
        ${!isApproved ? `
        <button class="btn btn-danger btn-lg" id="btn-reject">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="m15 9-6 6"/></svg>
          Retake Foto
        </button>
        <button class="btn btn-success btn-lg" id="btn-approve">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polyline points="20 6 9 17 4 12"/></svg>
          Approve &amp; Print
        </button>` : ''}
        <button class="btn btn-primary btn-lg" id="btn-download" ${isApproved ? 'style="grid-column:1/-1"' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download PNG
        </button>
      </div>
    </div>
  `;

  const idcardEl = container.querySelector('#idcard-render');

  // ──────────────────────────────────────────────────────────────
  // RENDER: APPROVED → fetch from GLPI | PENDING → CSS template
  // ──────────────────────────────────────────────────────────────
  if (isApproved) {
    // Show spinner while loading
    idcardEl.innerHTML = `
      <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#999;">
        <div class="spinner" style="width:32px;height:32px;border-width:3px;"></div>
        <span style="font-size:0.8rem;">Memuat dari GLPI...</span>
      </div>`;

    fetchIDCardBlobURL(emp.ticketId).then(function(result) {
      if (result && result.objectURL) {
        glpiURL  = result.objectURL;
        glpiBlob = result.blob;
        idcardEl.innerHTML = `
          <img src="${result.objectURL}"
               alt="ID Card ${emp.name}"
               style="width:100%;height:100%;object-fit:contain;display:block;border-radius:12px;"/>`;
      } else {
        // GLPI not available — fallback to local CSS render
        idcardEl.innerHTML = '';
        buildLocalCard();
        showToast('Gambar GLPI tidak tersedia, tampil preview lokal.', 'warning');
      }
    }).catch(function() {
      idcardEl.innerHTML = '';
      buildLocalCard();
      showToast('Gagal terhubung ke GLPI.', 'error');
    });

  } else {
    // Pending / review — render CSS template with panning
    buildLocalCard();
  }

  // ──────────────────────────────────────────────────────────────
  // BUILD LOCAL CSS CARD + PANNING (only for non-approved or fallback)
  // cardEl is safe to use after this function runs
  // ──────────────────────────────────────────────────────────────
  function buildLocalCard() {
    cardEl = renderIDCard({
      name:    emp.name,
      jabatan: emp.jabatan,
      nik:     emp.nik,
      photo:   photoToUse,
      panX:    emp.panX || 0,
      panY:    emp.panY || 0,
    });
    cardEl.dataset.name    = emp.name;
    cardEl.dataset.jabatan = emp.jabatan;
    cardEl.dataset.nik     = emp.nik;
    cardEl.dataset.photo   = photoToUse || '';
    cardEl.dataset.logo    = getLogo() || '';
    cardEl.dataset.panX    = emp.panX || 0;
    cardEl.dataset.panY    = emp.panY || 0;
    idcardEl.appendChild(cardEl);

    // Panning is only set up here, after cardEl exists
    setupPanning();
  }

  // ──────────────────────────────────────────────────────────────
  // PANNING — only called from buildLocalCard(), cardEl is always set
  // ──────────────────────────────────────────────────────────────
  function setupPanning() {
    var photoWrapper = cardEl.querySelector('.idcard-photo-wrapper');
    if (!photoWrapper || !photoToUse) return;

    photoWrapper.style.cursor = 'grab';
    photoWrapper.title = 'Geser foto untuk menyesuaikan posisi';

    var isDragging = false;
    var startX = 0, startY = 0;
    var currentX = emp.panX || 0;
    var currentY = emp.panY || 0;
    var clipDiv  = photoWrapper.querySelector('.idcard-photo-clip');
    var popDiv   = photoWrapper.querySelector('.idcard-photo-pop');

    function applyPan() {
      var bgPos = 'calc(50% + ' + currentX + 'px) calc(100% + ' + currentY + 'px)';
      if (clipDiv) clipDiv.style.backgroundPosition = bgPos;
      if (popDiv)  popDiv.style.backgroundPosition  = bgPos;
    }
    applyPan();

    function getScale() {
      var sc = container.querySelector('.idcard-preview-scale-container-v3');
      if (!sc) return 1;
      var m = sc.style.transform.match(/scale\(([^)]+)\)/);
      return m ? parseFloat(m[1]) : 1;
    }

    function onStart(e) {
      if (e.target.closest('button')) return;
      isDragging = true;
      photoWrapper.style.cursor = 'grabbing';
      var pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX; startY = pt.clientY;
      e.preventDefault();
    }
    function onMove(e) {
      if (!isDragging) return;
      var pt = e.touches ? e.touches[0] : e;
      var sc = getScale();
      currentX += (pt.clientX - startX) / sc;
      currentY += (pt.clientY - startY) / sc;
      startX = pt.clientX; startY = pt.clientY;
      applyPan();
    }
    function onEnd() {
      if (!isDragging) return;
      isDragging = false;
      photoWrapper.style.cursor = 'grab';
      updateEmployee(empId, { panX: currentX, panY: currentY });
      cardEl.dataset.panX = currentX;
      cardEl.dataset.panY = currentY;
    }

    photoWrapper.addEventListener('mousedown',  onStart);
    photoWrapper.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove',  onMove);
    document.addEventListener('mouseup',    onEnd);
    document.addEventListener('touchmove',  onMove, { passive: false });
    document.addEventListener('touchend',   onEnd);

    // Cleanup when leaving page
    container.querySelector('#btn-back').addEventListener('click', function() {
      document.removeEventListener('mousemove',  onMove);
      document.removeEventListener('mouseup',    onEnd);
      document.removeEventListener('touchmove',  onMove);
      document.removeEventListener('touchend',   onEnd);
      if (glpiURL) URL.revokeObjectURL(glpiURL);
    });
  }

  // ──────────────────────────────────────────────────────────────
  // AUTO-SCALE PREVIEW
  // ──────────────────────────────────────────────────────────────
  function scalePreview() {
    var wrapper  = container.querySelector('.idcard-preview-wrapper-v3');
    var scaleCt  = container.querySelector('.idcard-preview-scale-container-v3');
    if (!wrapper || !scaleCt) return;
    var avail = wrapper.clientWidth - 32;
    if (avail < 324) {
      var sc = avail / 324;
      scaleCt.style.transform = 'scale(' + sc + ')';
      wrapper.style.height    = (514 * sc + 60) + 'px';
      wrapper.style.minHeight = '0';
    } else {
      scaleCt.style.transform = 'scale(1)';
      wrapper.style.height    = '600px';
    }
  }
  setTimeout(scalePreview, 50);
  window.addEventListener('resize', scalePreview);
  var resizeObserver = new MutationObserver(function() {
    if (!document.body.contains(container)) {
      window.removeEventListener('resize', scalePreview);
      resizeObserver.disconnect();
    }
  });
  resizeObserver.observe(document.body, { childList: true, subtree: true });

  // ──────────────────────────────────────────────────────────────
  // COMPARISON TOGGLE
  // ──────────────────────────────────────────────────────────────
  container.querySelectorAll('.comparison-toggle button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      container.querySelectorAll('.comparison-toggle button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var previewWrapper = container.querySelector('.idcard-preview-wrapper-v3');
      var comparison     = container.querySelector('#photo-comparison');
      if (btn.dataset.view === 'card') {
        if (previewWrapper) previewWrapper.style.display = 'grid';
        if (comparison)     comparison.style.display = 'none';
      } else {
        if (previewWrapper) previewWrapper.style.display = 'none';
        if (comparison)     comparison.style.display = 'block';
      }
    });
  });

  // ──────────────────────────────────────────────────────────────
  // BACK BUTTON
  // ──────────────────────────────────────────────────────────────
  container.querySelector('#btn-back').addEventListener('click', function() {
    if (glpiURL) URL.revokeObjectURL(glpiURL);
    goBack(isApproved ? '/finished' : '/');
  });

  // ──────────────────────────────────────────────────────────────
  // REJECT (pending only)
  // ──────────────────────────────────────────────────────────────
  if (!isApproved) {
    container.querySelector('#btn-reject').addEventListener('click', function() {
      resetEmployee(empId);
      showToast('Foto direset. Silakan ambil ulang.', 'warning');
      navigate('/detail/' + empId);
    });
  }

  // ──────────────────────────────────────────────────────────────
  // DOWNLOAD
  // ──────────────────────────────────────────────────────────────
  container.querySelector('#btn-download').addEventListener('click', async function() {
    var btn = container.querySelector('#btn-download');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Exporting...';
    var filename = 'IDCard_' + emp.name.replace(/\s+/g, '_') + '_' + emp.nik + '.png';

    try {
      if (isApproved) {
        // Download directly from GLPI blob
        var blob = glpiBlob;
        if (!blob) {
          var res = await fetchIDCardBlobURL(emp.ticketId);
          blob = res && res.blob;
        }
        if (blob) {
          downloadFile(blob, filename);
          showToast('Downloaded from GLPI', 'success');
        } else {
          showToast('File tidak ditemukan di GLPI.', 'error');
        }
      } else {
        // Canvas export from CSS template — cardEl must exist here
        if (!cardEl) { showToast('Preview belum siap, coba lagi.', 'warning'); return; }
        var result = await exportToImage(cardEl, 300);
        downloadFile(result.blob, filename);
        showToast('Exported: ' + result.width + '×' + result.height + 'px (300 DPI)', 'success');
      }
    } catch (err) {
      showToast('Export gagal: ' + err.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download PNG';
  });

  // ──────────────────────────────────────────────────────────────
  // APPROVE & PRINT (pending only)
  // ──────────────────────────────────────────────────────────────
  if (!isApproved) {
    container.querySelector('#btn-approve').addEventListener('click', async function() {
      if (!cardEl) { showToast('Preview belum siap.', 'warning'); return; }
      var btn = container.querySelector('#btn-approve');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Processing...';

      try {
        var result = await exportToImage(cardEl, 300);
        approveEmployee(empId);

        var uploadSuccess = await uploadToGLPI(emp.ticketId, result.blob);
        if (uploadSuccess) {
          showToast('Berhasil approve & upload ke GLPI', 'success');
        } else {
          showToast('Approve lokal berhasil, tapi gagal upload ke GLPI.', 'warning');
        }

        await triggerWebhook('card_approved', {
          employeeId: empId,
          name: emp.name,
          nik: emp.nik,
          ticketId: emp.ticketId,
        });

        navigate('/finished');
      } catch (err) {
        console.error('Approve failed:', err);
        showToast('Gagal memproses approval: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polyline points="20 6 9 17 4 12"/></svg> Approve &amp; Print';
      }
    });
  }
}
