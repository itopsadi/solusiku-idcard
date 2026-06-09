import { getEmployees } from '../services/api.js';
import { statusBadge, debounce, formatDate, getTicketUrl } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';

export async function renderFinished(container) {
  let currentPage = 1;
  const itemsPerPage = 15;
  let currentSearchQuery = '';

  const employees = await getEmployees();
  // Ambil yang sudah selesai (approved + cancelled) dan urutkan terbaru di atas
  const finishedEmployees = employees
    .filter(e => e.status === 'approved' || e.status === 'cancelled')
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
  `;

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
    attachRowListeners(tbody);

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
  return employees.map(emp => `
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
    </tr>
  `).join('');
}

function attachRowListeners(tbody) {
  tbody.querySelectorAll('.emp-row').forEach(row => {
    row.addEventListener('click', () => {
      // Karena ini sudah approved, kita arahkan ke halaman preview untuk bisa melihat atau mengunduh ulang ID Card
      navigate(`/approval/${row.dataset.id}`);
    });
  });
}
