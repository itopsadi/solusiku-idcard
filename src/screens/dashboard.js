import { getEmployees, getStats } from '../services/api.js';
import { statusBadge, debounce, formatDate, blobToDataURL } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { getLogo } from '../templates/idcard.js';
import { showToast } from '../utils/toast.js';

export async function renderDashboard(container) {
  const stats = await getStats();
  const allEmployees = await getEmployees();
  // Filter out approved employees so they don't clutter the main queue
  const employees = allEmployees.filter(e => e.status !== 'approved');
  const currentLogo = getLogo();

  container.innerHTML = `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h1>Dashboard</h1>
        <p>IT Operations Control Center — ID Card Automation</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card animate-in delay-1" style="--card-accent: var(--gradient-1)">
        <div class="stat-icon" style="background:rgba(99,102,241,0.12);color:var(--accent)">📋</div>
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">Total Karyawan</div>
      </div>
      <div class="stat-card animate-in delay-2" style="--card-accent: linear-gradient(135deg, #f59e0b, #ef4444)">
        <div class="stat-icon" style="background:rgba(245,158,11,0.12);color:var(--amber)">📸</div>
        <div class="stat-value">${stats.waiting}</div>
        <div class="stat-label">Menunggu Foto</div>
      </div>
      <div class="stat-card animate-in delay-3" style="--card-accent: linear-gradient(135deg, #6366f1, #8b5cf6)">
        <div class="stat-icon" style="background:rgba(99,102,241,0.12);color:#818cf8">⚙️</div>
        <div class="stat-value">${stats.processing + stats.ready}</div>
        <div class="stat-label">Diproses</div>
      </div>
      <div class="stat-card animate-in delay-4" style="--card-accent: var(--gradient-2)">
        <div class="stat-icon" style="background:rgba(16,185,129,0.12);color:var(--emerald)">✅</div>
        <div class="stat-value">${stats.approved}</div>
        <div class="stat-label">Selesai</div>
      </div>
    </div>

    <div class="search-bar animate-in" style="animation-delay:0.25s">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="text" id="search-input" placeholder="Cari karyawan berdasarkan nama, NIK, atau jabatan..." autocomplete="off"/>
    </div>

    <div class="data-table animate-in" style="animation-delay:0.3s">
      <table>
        <thead>
          <tr>
            <th>Nama</th>
            <th>Lokasi</th>
            <th>NIK</th>
            <th>Ticket</th>
            <th>Status</th>
            <th>Tanggal</th>
          </tr>
        </thead>
        <tbody id="employee-table-body">
          ${renderRows(employees)}
        </tbody>
      </table>
      <div id="empty-state" class="empty-state" style="display:none">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <h3>Tidak ada hasil</h3>
        <p>Coba ubah kata kunci pencarian</p>
      </div>
    </div>
  `;

  // Search handler
  const searchInput = container.querySelector('#search-input');
  const tbody = container.querySelector('#employee-table-body');
  const emptyState = container.querySelector('#empty-state');

  const handleSearch = debounce((query) => {
    const q = query.toLowerCase().trim();
    const filtered = employees.filter(e =>
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
    <tr data-id="${emp.id}" data-status="${emp.status}" class="emp-row">
      <td data-label="Nama">
        <div class="emp-name">${emp.name}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">${emp.jabatan}</div>
      </td>
      <td data-label="Lokasi" style="color:var(--text-muted);font-size:0.85rem">${emp.location || '-'}</td>
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
      const status = row.dataset.status;
      if (status === 'ready_review' || status === 'approved') {
        navigate(`/approval/${row.dataset.id}`);
      } else {
        navigate(`/detail/${row.dataset.id}`);
      }
    });
  });
}
