import { getEmployees, markAsPrinted, getPrintedInfo } from '../services/api.js';
import { statusBadge, debounce, formatDate, getTicketUrl } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';

// Signature State (Module Level)
let currentEmpIdToPrint = null;
let currentBtnElement = null;

export async function renderFinished(container) {
  let currentPage = 1;
  const itemsPerPage = 15;
  let currentSearchQuery = '';

  const employees = await getEmployees();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Ambil yang sudah selesai (approved + cancelled + printed) dalam 90 hari terakhir dan urutkan terbaru di atas
  const finishedEmployees = employees
    .filter(e => (e.status === 'approved' || e.status === 'cancelled' || e.status === 'printed') && new Date(e.createdAt) >= ninetyDaysAgo)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  container.innerHTML = `
    <div class="page-header animate-in">
      <h1>Selesai</h1>
      <p>Daftar ID Card yang telah selesai diproses dan diunggah ke GLPI</p>
    </div>

    <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; margin-bottom:20px;" class="animate-in delay-1">
      <div class="search-bar" style="margin-bottom:0; flex:1; min-width: 260px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" id="finished-search-input" placeholder="Cari data selesai berdasarkan nama, NIK, atau jabatan..." autocomplete="off"/>
      </div>
      <div id="finished-pagination" style="display:flex; justify-content:flex-end; align-items:center; gap:8px;"></div>
    </div>

    <div class="data-table animate-in delay-2">
      <table>
        <thead>
          <tr>
            <th>Nama</th>
            <th>Departemen</th>
            <th>NIK</th>
            <th>Ticket</th>
            <th>Status</th>
            <th>Tanggal</th>
            <th style="width: 130px; text-align: center;">Aksi</th>
          </tr>
        </thead>
        <tbody id="finished-table-body">
        </tbody>
      </table>
      <div id="finished-empty-state" class="empty-state" style="display:none">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        <h3 id="empty-state-title">Tidak ada data selesai</h3>
        <p id="empty-state-desc">Belum ada ID Card yang selesai diproses.</p>
      </div>
    </div>
    
    <!-- Signature Modal -->
    <div id="signature-modal" class="modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
      <div class="modal-content" style="background:var(--bg-card); padding:24px; border-radius:var(--radius-lg); width:90%; max-width:500px; box-shadow: var(--shadow-lg);">
        <h3 style="margin-top:0; margin-bottom:16px;">Tanda Tangan Teknisi</h3>
        <p style="margin-bottom:8px; font-size:0.9rem; color:var(--text-secondary);">Konfirmasi pencetakan fisik ID Card untuk <b id="sig-emp-name"></b></p>
        

        
        <label style="display:block; font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Tanda Tangan</label>
        <div class="signature-canvas-wrapper" style="width:100%; position:relative;">
          <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:var(--text-muted); opacity:0.3; font-size:1.8rem; font-weight:700; pointer-events:none; font-style:italic; font-family:var(--font-display);">Sign Here</div>
          <canvas id="sig-canvas" class="signature-canvas" style="position:relative; z-index:1;"></canvas>
        </div>
        
        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:20px;">
          <button id="btn-sig-cancel" class="btn btn-ghost">Batal</button>
          <button id="btn-sig-clear" class="btn btn-outline" style="border: 1px solid var(--border); background: transparent; color: var(--text-primary);">Bersihkan</button>
          <button id="btn-sig-save" class="btn btn-primary">Simpan & Tandai</button>
        </div>
      </div>
    </div>
  `;

  // Canvas State
  let isDrawing = false;

  // Selectors
  const sigModal = container.querySelector('#signature-modal');
  const sigCanvas = container.querySelector('#sig-canvas');
  const sigCtx = sigCanvas.getContext('2d');
  const sigEmpName = container.querySelector('#sig-emp-name');

  // Canvas Logic
  function resizeCanvas() {
    const wrapper = sigCanvas.parentElement;
    const rect = wrapper.getBoundingClientRect();
    sigCanvas.width = rect.width;
    sigCanvas.height = rect.height;
    sigCtx.lineWidth = 2.5;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    sigCtx.strokeStyle = document.body.classList.contains('dark-theme') ? '#e2e8f0' : '#0f172a';
  }

  function getCoordinates(e) {
    const rect = sigCanvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  const startDrawing = (e) => { e.preventDefault(); isDrawing = true; const { x, y } = getCoordinates(e); sigCtx.beginPath(); sigCtx.moveTo(x, y); };
  const draw = (e) => { e.preventDefault(); if (!isDrawing) return; const { x, y } = getCoordinates(e); sigCtx.lineTo(x, y); sigCtx.stroke(); };
  const stopDrawing = (e) => { e.preventDefault(); isDrawing = false; };

  sigCanvas.addEventListener('mousedown', startDrawing);
  sigCanvas.addEventListener('mousemove', draw);
  sigCanvas.addEventListener('mouseup', stopDrawing);
  sigCanvas.addEventListener('mouseout', stopDrawing);
  sigCanvas.addEventListener('touchstart', startDrawing, { passive: false });
  sigCanvas.addEventListener('touchmove', draw, { passive: false });
  sigCanvas.addEventListener('touchend', stopDrawing, { passive: false });

  container.querySelector('#btn-sig-clear').addEventListener('click', () => {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
  });

  container.querySelector('#btn-sig-cancel').addEventListener('click', () => {
    sigModal.style.display = 'none';
    currentEmpIdToPrint = null;
    currentBtnElement = null;
  });

  container.querySelector('#btn-sig-save').addEventListener('click', async () => {
    if (!currentEmpIdToPrint || !currentBtnElement) return;
    
    // Check empty canvas
    const blank = document.createElement('canvas');
    blank.width = sigCanvas.width; blank.height = sigCanvas.height;
    if (sigCanvas.toDataURL() === blank.toDataURL()) {
      alert('Tanda tangan tidak boleh kosong!'); return;
    }

    const signatureDataURL = sigCanvas.toDataURL('image/png');
    const sessionData = JSON.parse(localStorage.getItem('solusiku_user_profile') || '{}');
    const technicianName = sessionData.name || 'Teknisi IT';
    const btn = currentBtnElement;
    sigModal.style.display = 'none';
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;border-color:white;border-top-color:transparent;margin:0 auto;"></div>';
    btn.disabled = true;
    
    try {
      await markAsPrinted(currentEmpIdToPrint, signatureDataURL, technicianName);
      updateUI();
    } catch(err) {
      if (window._toastModule) window._toastModule.showToast('Gagal: ' + err.message, 'error');
      else alert('Gagal: ' + err.message);
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });

  // Search handler
  const searchInput = container.querySelector('#finished-search-input');
  const tbody = container.querySelector('#finished-table-body');
  const emptyState = container.querySelector('#finished-empty-state');
  const emptyStateTitle = container.querySelector('#empty-state-title');
  const emptyStateDesc = container.querySelector('#empty-state-desc');
  const paginationControls = container.querySelector('#finished-pagination');

  function updateUI() {
    const q = currentSearchQuery.toLowerCase().trim();
    const filtered = finishedEmployees.filter(e =>
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.nik.toLowerCase().includes(q) ||
      e.jabatan.toLowerCase().includes(q) ||
      e.ticketId.toLowerCase().includes(q) ||
      (e.location && e.location.toLowerCase().includes(q))
    );

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    if (currentPage > totalPages) currentPage = totalPages;

    if (totalItems === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      paginationControls.innerHTML = '';
      if (q) {
        emptyStateTitle.textContent = 'Tidak ada hasil';
        emptyStateDesc.textContent = 'Coba ubah kata kunci pencarian.';
      } else {
        emptyStateTitle.textContent = 'Tidak ada data selesai';
        emptyStateDesc.textContent = 'Belum ada ID Card yang selesai diproses.';
      }
      return;
    }

    emptyState.style.display = 'none';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filtered.slice(startIndex, endIndex);

    tbody.innerHTML = renderRows(pageItems);
    attachRowListeners(tbody, updateUI, finishedEmployees, container);

    // Render pagination controls
    paginationControls.innerHTML = `
      <button id="btn-prev-page" class="btn btn-outline" style="padding:0 10px; height:36px; min-width:36px; display:flex; align-items:center; justify-content:center; border-radius:8px;" ${currentPage === 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <span style="font-size:0.85rem; color:var(--text-primary); font-weight:600; padding:0 8px;">
        ${currentPage} / ${totalPages}
      </span>
      <button id="btn-next-page" class="btn btn-outline" style="padding:0 10px; height:36px; min-width:36px; display:flex; align-items:center; justify-content:center; border-radius:8px;" ${currentPage === totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    `;

    // Bind Pagination Button Listeners
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    if (btnPrev && currentPage > 1) {
      btnPrev.addEventListener('click', () => {
        currentPage--;
        updateUI();
      });
    }
    if (btnNext && currentPage < totalPages) {
      btnNext.addEventListener('click', () => {
        currentPage++;
        updateUI();
      });
    }
  }

  const handleSearch = debounce((query) => {
    currentSearchQuery = query;
    currentPage = 1; // Reset to page 1 on new search
    updateUI();
  });

  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  
  // Initial render
  updateUI();
}

function renderRows(employees) {
  if (!employees.length) return '';
  return employees.map(emp => {
    let aksiHtml = `<span style="font-size: 0.75rem; color: var(--text-muted);">-</span>`;
    
    if (emp.status === 'approved') {
      aksiHtml = `<button class="btn btn-primary btn-mark-printed" data-id="${emp.id}" style="padding: 6px 12px; font-size: 0.75rem; width: 100%;">Tandai Dicetak</button>`;
    } else if (emp.status === 'printed') {
      const pInfo = getPrintedInfo(emp.ticketId);
      const techName = pInfo ? pInfo.technicianName : 'Teknisi';
      aksiHtml = `<span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Sudah Di Cetak<br><small style="opacity:0.8;">[${techName}]</small></span>`;
    }

    return `
    <tr data-id="${emp.id}" class="emp-row">
      <td data-label="Nama">
        <div class="emp-name">${emp.name}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
          <span style="font-style: italic;">${emp.jabatan}</span>
          ${emp.location && emp.location !== '-' ? `<span style="display:inline-flex; align-items:center; gap:3px; color:var(--primary-color); opacity:0.8;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${emp.location}</span>` : ''}
        </div>
      </td>
      <td data-label="Departemen" style="color:var(--text-muted);font-size:0.85rem">${emp.department || '-'}</td>
      <td data-label="NIK"><span class="emp-nik">${emp.nik}</span></td>
      <td data-label="Ticket">
        <a href="${getTicketUrl(emp.ticketId)}" target="_blank" class="ticket-link" onclick="event.stopPropagation()">
          ${emp.ticketId}
        </a>
      </td>
      <td data-label="Status">${statusBadge(emp.status)}</td>
      <td data-label="Tanggal" style="color:var(--text-muted);font-size:0.82rem">${formatDate(emp.createdAt)}</td>
      <td data-label="Aksi" style="text-align: center;">
        ${aksiHtml}
      </td>
    </tr>
    `;
  }).join('');
}

function attachRowListeners(tbody, updateUI, finishedEmployees, container) {
  tbody.querySelectorAll('.emp-row').forEach(row => {
    row.addEventListener('click', () => {
      // Karena ini sudah approved/printed, kita arahkan ke halaman preview
      navigate(`/approval/${row.dataset.id}`);
    });
  });

  tbody.querySelectorAll('.btn-mark-printed').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const empId = btn.dataset.id;
      const emp = finishedEmployees.find(e => e.id === empId);
      if (!emp) return;
      
      // Pass data to modal
      currentEmpIdToPrint = empId;
      currentBtnElement = btn;
      const sigEmpName = container.querySelector('#sig-emp-name');
      const sigModal = container.querySelector('#signature-modal');
      const sigCanvas = container.querySelector('#sig-canvas');
      const sigCtx = sigCanvas.getContext('2d');
      
      sigEmpName.textContent = emp.name;
      
      sigModal.style.display = 'flex';
      
      // Delay resize slightly so modal can be rendered before calculation
      setTimeout(() => {
        const wrapper = sigCanvas.parentElement;
        const rect = wrapper.getBoundingClientRect();
        sigCanvas.width = rect.width;
        sigCanvas.height = rect.height;
        sigCtx.lineWidth = 2.5;
        sigCtx.lineCap = 'round';
        sigCtx.lineJoin = 'round';
        sigCtx.strokeStyle = document.body.classList.contains('dark-theme') ? '#e2e8f0' : '#0f172a';
        sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
      }, 50);
    });
  });
}
