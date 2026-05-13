import { getEmployees } from '../services/api.js';
import { statusBadge, debounce, formatDate } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';

export async function renderFinished(container) {
  const employees = await getEmployees();
  // Ambil yang sudah selesai (approved) dan urutkan terbaru di atas
  const finishedEmployees = employees
    .filter(e => e.status === 'approved')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  container.innerHTML = `
    <div class="page-header animate-in">
      <h1>Selesai</h1>
      <p>Daftar ID Card yang telah selesai diproses dan diunggah ke GLPI</p>
    </div>

    <div class="search-bar animate-in delay-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="text" id="finished-search-input" placeholder="Cari data selesai berdasarkan nama, NIK, atau jabatan..." autocomplete="off"/>
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
          ${renderRows(finishedEmployees)}
        </tbody>
      </table>
      <div id="finished-empty-state" class="empty-state" style="display:${finishedEmployees.length ? 'none' : 'block'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        <h3>Tidak ada data selesai</h3>
        <p>Belum ada ID Card yang selesai diproses.</p>
      </div>
    </div>
  `;

  // Search handler
  const searchInput = container.querySelector('#finished-search-input');
  const tbody = container.querySelector('#finished-table-body');
  const emptyState = container.querySelector('#finished-empty-state');

  const handleSearch = debounce((query) => {
    const q = query.toLowerCase().trim();
    const filtered = finishedEmployees.filter(e =>
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.nik.toLowerCase().includes(q) ||
      e.jabatan.toLowerCase().includes(q) ||
      e.ticketId.toLowerCase().includes(q) ||
      (e.location && e.location.toLowerCase().includes(q))
    );
    tbody.innerHTML = renderRows(filtered);
    emptyState.style.display = filtered.length ? 'none' : 'block';
    attachRowListeners(tbody);
  });

  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  attachRowListeners(tbody);
}

function renderRows(employees) {
  if (!employees.length) return '';
  return employees.map(emp => `
    <tr data-id="${emp.id}" class="emp-row">
      <td data-label="Nama">
        <div class="emp-name">${emp.name}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">${emp.jabatan}</div>
      </td>
      <td data-label="Departemen" style="color:var(--text-muted);font-size:0.85rem">${emp.department || '-'}</td>
      <td data-label="NIK"><span class="emp-nik">${emp.nik}</span></td>
      <td data-label="Ticket"><span class="emp-nik">${emp.ticketId}</span></td>
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
