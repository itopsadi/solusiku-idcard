import { 
  getEmployees, checkGLPIUserExists, createGLPIUser, addGLPIUserEmail,
  getAllGLPIGroups, getAllGLPILocations, getAllGLPIUsers,
  addGLPIUserGroup, getEmployee, REAL_GLPI_URL, fetchIDCardBlobURL
} from '../services/api.js';

function generateRandomPassword(length = 10) {
  const lowers = "abcdefghijklmnopqrstuvwxyz";
  const uppers = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*_+";
  
  let password = "";
  // Pastikan selalu ada minimal 1 karakter dari masing-masing tipe (Syarat kompleksitas GLPI)
  password += lowers.charAt(Math.floor(Math.random() * lowers.length));
  password += uppers.charAt(Math.floor(Math.random() * uppers.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += symbols.charAt(Math.floor(Math.random() * symbols.length));
  
  const allChars = lowers + uppers + numbers + symbols;
  for (let i = password.length; i < length; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Acak urutan karakter agar polanya tidak selalu lower-upper-number-symbol di awal
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

function generateEmail(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().toLowerCase().split(/\s+/);
  if (parts.length === 1) return `${parts[0]}@solusi-ku.id`;
  return `${parts[0]}.${parts[parts.length - 1]}@solusi-ku.id`;
}

// Main render function — returns SYNCHRONOUSLY so router can fade-in the skeleton immediately
export function renderUserMaker(container) {
  // Show skeleton loading immediately
  container.innerHTML = `
    <div class="header-section">
      <h1 class="page-title">GLPI User Maker</h1>
      <p class="page-subtitle">Buat User GLPI otomatis dari data onboarding yang telah disetujui.</p>
    </div>
    
    <div id="user-maker-content" class="fade-in">
      <div style="padding:24px; text-align:center;">
        <div class="spinner-large" style="margin: 0 auto 16px;"></div>
        <p style="color:var(--text-muted); font-weight:500; font-size:0.95rem;">Mengambil data dari GLPI...</p>
        <p style="color:var(--text-muted); font-size:0.8rem; margin-top:4px; opacity:0.7;">Memuat daftar karyawan, lokasi, dan grup</p>
      </div>
      <div class="grid" style="margin-top:16px;">
        ${[1,2,3].map(() => `
          <div class="card" style="display:flex; flex-direction:column; animation: pulse 1.5s ease-in-out infinite;">
            <div style="display:flex; gap:16px; margin-bottom:16px;">
              <div style="width:60px; height:60px; border-radius:50%; background:var(--border); flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="height:16px; width:70%; background:var(--border); border-radius:4px; margin-bottom:8px;"></div>
                <div style="height:12px; width:50%; background:var(--border); border-radius:4px; margin-bottom:6px;"></div>
                <div style="height:12px; width:40%; background:var(--border); border-radius:4px;"></div>
              </div>
            </div>
            <div style="height:40px; width:100%; background:var(--border); border-radius:8px; margin-top:auto;"></div>
          </div>
        `).join('')}
      </div>
    </div>
    <style>
      .um-card-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 16px;
        min-height: 80px;
        animation: fadeIn 0.25s ease-out;
      }
      .um-employee-info {
        display: flex;
        gap: 16px;
        align-items: center;
        flex: 1;
        min-width: 0;
      }
      .um-action-group {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
        justify-content: flex-end;
      }
      @media (max-width: 576px) {
        .um-card-container {
          gap: 10px;
          padding: 12px 10px;
        }
        .um-employee-info {
          gap: 10px;
        }
        .um-action-group {
          flex-direction: column;
          align-items: stretch;
          gap: 6px;
        }
        .um-action-group > * {
          width: 100% !important;
          text-align: center !important;
          justify-content: center !important;
          padding: 6px 10px !important;
          font-size: 0.72rem !important;
          height: auto !important;
          min-height: 32px !important;
        }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      @keyframes fadeIn {
        from { opacity: 0; backdrop-filter: blur(0px); }
        to { opacity: 1; backdrop-filter: blur(8px); }
      }
      @keyframes fadeOut {
        from { opacity: 1; backdrop-filter: blur(8px); }
        to { opacity: 0; backdrop-filter: blur(0px); }
      }
    </style>
  `;

  // Remove any previous modal wrapper
  const oldWrapper = document.getElementById('um-modals-wrapper');
  if (oldWrapper) oldWrapper.remove();

  // State for cleanup
  let debounceTimer = null;

  // Kick off async data loading AFTER the skeleton is visible
  setTimeout(() => initUserMaker(container), 50);

  // Return cleanup function immediately so router can proceed
  return () => {
    clearTimeout(debounceTimer);
    const wrapper = document.getElementById('um-modals-wrapper');
    if (wrapper) wrapper.remove();
  };

  // ---- All async logic below ----
  async function initUserMaker(container) {
    const content = document.getElementById('user-maker-content');
    if (!content) return; // User navigated away

    // Create modals and append directly to <body>
    const modalContainer = document.createElement('div');
    modalContainer.id = 'um-modals-wrapper';
    modalContainer.innerHTML = `
      <!-- Modal for User Creation -->
      <div id="user-modal-backdrop" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.85); backdrop-filter:blur(4px); z-index:9999; overflow-y:auto;">
        <div style="background:var(--bg-secondary); width:calc(100% - 40px); max-width:600px; border-radius:16px; padding:24px; box-shadow:0 10px 40px rgba(0,0,0,0.4); position:relative; margin: 5vh auto;">
          <button id="close-user-modal" style="position:absolute; top:16px; right:16px; background:none; border:none; cursor:pointer; color:var(--text-muted);">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <h2 style="margin-bottom:20px; font-weight:700; color:var(--text-primary);">Create GLPI User</h2>
          <form id="form-create-user">
            <input type="hidden" id="cu-id" />
            
            <div style="display:flex; gap:12px; margin-bottom:16px;">
              <div style="flex:1;">
                <label style="display:block; font-size:0.85rem; font-weight:600; color:var(--text-muted); margin-bottom:6px;">First Name <span style="color:var(--rose);">*</span></label>
                <input type="text" id="cu-firstname" class="setting-input" style="background:var(--bg-primary);" required />
              </div>
              <div style="flex:1;">
                <label style="display:block; font-size:0.85rem; font-weight:600; color:var(--text-muted); margin-bottom:6px;">Last Name <span style="color:var(--rose);">*</span></label>
                <input type="text" id="cu-lastname" class="setting-input" style="background:var(--bg-primary);" required />
              </div>
            </div>

            <div style="display:flex; gap:12px; margin-bottom:16px;">
              <div style="flex:1;">
                <label style="display:block; font-size:0.85rem; font-weight:600; color:var(--text-muted); margin-bottom:6px;">Email / Username <span style="color:var(--rose);">*</span></label>
                <input type="email" id="cu-email" class="setting-input" style="background:var(--bg-primary);" required />
              </div>
              <div style="flex:1;">
                <label style="display:block; font-size:0.85rem; font-weight:600; color:var(--text-muted); margin-bottom:6px;">NIK (Nomor Administrasi) <span style="color:var(--rose);">*</span></label>
                <input type="text" id="cu-nik" class="setting-input" style="background:var(--bg-primary);" required />
              </div>
            </div>
            <div id="username-status" style="font-size:0.75rem; margin-top:-10px; margin-bottom:16px; min-height:14px;"></div>

            <div style="display:flex; gap:12px; margin-bottom:16px;">
              <div style="flex:1;">
                <label style="display:block; font-size:0.85rem; font-weight:600; color:var(--text-muted); margin-bottom:6px;">Group (Departemen) <span style="color:var(--rose);">*</span></label>
                <select id="cu-group" class="setting-input" style="cursor:pointer; appearance:auto; background:var(--bg-primary);" required>
                  <option value="" disabled selected>-- Pilih Group --</option>
                </select>
              </div>
              <div style="flex:1;">
                <label style="display:block; font-size:0.85rem; font-weight:600; color:var(--text-muted); margin-bottom:6px;">Lokasi Bekerja <span style="color:var(--rose);">*</span></label>
                <select id="cu-location" class="setting-input" style="cursor:pointer; appearance:auto; background:var(--bg-primary);" required>
                  <option value="" disabled selected>-- Pilih Lokasi --</option>
                </select>
              </div>
            </div>

            <div style="margin-bottom:16px;">
              <label style="display:block; font-size:0.85rem; font-weight:600; color:var(--text-muted); margin-bottom:6px;">Supervisor / Atasan <span style="color:var(--rose);">*</span></label>
              <input list="datalist-users" id="cu-supervisor" class="setting-input" style="background:var(--bg-primary);" placeholder="Cari & pilih nama supervisor..." required />
              <datalist id="datalist-users"></datalist>
            </div>

            <div style="margin-bottom:24px;">
              <label style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; font-weight:600; color:var(--text-muted); margin-bottom:6px;">
                <span>Password (Generated) <span style="color:var(--rose);">*</span></span>
                <button type="button" id="btn-regen-pwd" style="background:none; border:none; color:var(--accent); font-size:0.75rem; cursor:pointer; font-weight:600;">Regenerate</button>
              </label>
              <input type="text" id="cu-password" class="setting-input" style="font-family:monospace; font-size:1.1rem; letter-spacing:1px; background:var(--bg-primary);" required readonly />
            </div>

            <button type="submit" id="btn-submit-user" class="btn btn-primary" style="width:100%;">Create User</button>
          </form>
        </div>
      </div>

      <!-- Credentials Popup Modal -->
      <div id="creds-modal-backdrop" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.85); backdrop-filter:blur(4px); z-index:10000; overflow-y:auto;">
        <div style="background:var(--bg-secondary); width:calc(100% - 40px); max-width:420px; border-radius:16px; padding:24px; box-shadow:0 10px 40px rgba(0,0,0,0.4); text-align:center; position:relative; margin: 10vh auto;">
          <div style="width:50px; height:50px; background:var(--success-light); color:var(--success); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <h2 style="margin-bottom:8px; font-weight:700; color:var(--text-primary);">User Berhasil Dibuat</h2>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px;">Silakan berikan kredensial berikut kepada karyawan bersangkutan.</p>
          
          <div style="background:var(--primary-light); color:var(--primary-color); border:1px dashed var(--primary-color); padding:12px; border-radius:8px; font-size:0.8rem; text-align:left; margin-bottom:16px; line-height:1.45;">
            <strong style="display:inline-flex; align-items:center; gap:4px; margin-bottom:2px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> Catatan Penting Teknisi:</strong><br/>
            Harap segera melengkapi data profil user ini (seperti mengunggah foto profil, memeriksa ketepatan lokasi bekerja, dan memeriksa grup departemen) melalui tombol <strong>Lihat di GLPI</strong> di dashboard aplikasi.
          </div>
          
          <div style="background:var(--bg-primary); padding:16px; border-radius:8px; text-align:left; font-size:0.9rem; margin-bottom:20px; border:1px solid var(--border);">
            <div style="margin-bottom:8px;"><span style="color:var(--text-muted); display:inline-block; width:80px;">Name:</span> <strong id="cred-name" style="color:var(--text-primary);"></strong></div>
            <div style="margin-bottom:8px;"><span style="color:var(--text-muted); display:inline-block; width:80px;">Username:</span> <strong id="cred-uname" style="color:var(--text-primary);"></strong></div>
            <div><span style="color:var(--text-muted); display:inline-block; width:80px;">Password:</span> <strong id="cred-pwd" style="color:var(--text-primary); font-family:monospace;"></strong></div>
          </div>

          <button id="btn-copy-creds" class="btn btn-primary" style="width:100%; margin-bottom:8px;">Copy to Clipboard</button>
          <button id="btn-close-creds" class="btn btn-outline" style="width:100%;">Tutup</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalContainer);

    const modal = document.getElementById('user-modal-backdrop');
    
    // Elements (now in document.body)
    const inpFn = document.getElementById('cu-firstname');
    const inpLn = document.getElementById('cu-lastname');
    const inpNik = document.getElementById('cu-nik');
    const inpEm = document.getElementById('cu-email');
    const inpPw = document.getElementById('cu-password');
    const selGroup = document.getElementById('cu-group');
    const selLoc = document.getElementById('cu-location');
    const inpSupervisor = document.getElementById('cu-supervisor');
    const datalistUsers = document.getElementById('datalist-users');
    const statusUn = document.getElementById('username-status');

    let glpiGroups = [];
    let glpiLocations = [];
    let glpiUsers = [];

    try {
      // Fetch initial data
      const [allEmployees, groups, locations, users] = await Promise.all([
        getEmployees(),
        getAllGLPIGroups(),
        getAllGLPILocations(),
        getAllGLPIUsers()
      ]);

      glpiGroups = groups;
      glpiLocations = locations;
      glpiUsers = users;

      console.log('[UserMaker] Groups:', glpiGroups.length, '| Locations:', glpiLocations.length, '| Users:', glpiUsers.length);

      // Populate selects & datalists
      glpiGroups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id; opt.textContent = g.name;
        selGroup.appendChild(opt);
      });
      glpiLocations.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id; opt.textContent = l.name;
        selLoc.appendChild(opt);
      });
      console.log('[UserMaker] Location dropdown options count:', selLoc.options.length);
      glpiUsers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.name; 
        opt.textContent = `${u.realname || ''} ${u.firstname || ''}`.trim();
        datalistUsers.appendChild(opt);
      });

      // Only approved employees
      const approved = allEmployees.filter(e => e.status === 'approved');

      if (approved.length === 0) {
        content.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon" style="background:var(--success-light);color:var(--success);">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <h3>Tidak Ada Data Approved</h3>
            <p>Selesaikan pembuatan ID Card pada tab "Selesai" untuk membuat User GLPI-nya.</p>
          </div>
        `;
        return;
      }

      let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <!-- Search Bar -->
          <div class="search-bar" style="margin-bottom:0; flex:1; min-width:280px; max-width:500px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" id="um-search-input" placeholder="Cari karyawan berdasarkan nama, jabatan, departemen, atau NIK..." autocomplete="off"/>
          </div>
          
          <!-- Pagination Controls -->
          <div id="um-pagination-controls" style="display:flex; align-items:center; gap:8px;"></div>
        </div>

        <div id="um-empty-search" class="empty-state" style="display:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;margin-bottom:12px;color:var(--text-muted);"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <h3>Tidak ada hasil</h3>
          <p>Coba ubah kata kunci pencarian</p>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px;" id="um-card-grid"></div>
      `;
      content.innerHTML = html;

      const cardGrid = document.getElementById('um-card-grid');
      const emptySearch = document.getElementById('um-empty-search');
      const searchInput = document.getElementById('um-search-input');
      const paginationControls = document.getElementById('um-pagination-controls');

      let currentPage = 1;
      const itemsPerPage = 10;
      let filtered = [...approved];

      function updateUI() {
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIdx = (currentPage - 1) * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const pageItems = filtered.slice(startIdx, endIdx);

        if (totalItems === 0) {
          cardGrid.style.display = 'none';
          emptySearch.style.display = 'block';
          paginationControls.innerHTML = '';
          return;
        }

        cardGrid.style.display = 'flex';
        emptySearch.style.display = 'none';

        // Render card items
        let gridHtml = '';
        pageItems.forEach(emp => {
          const email = generateEmail(emp.name);
          const isExisting = glpiUsers.find(u => {
            return u.name && u.name.toLowerCase() === email.toLowerCase();
          });          gridHtml += `
            <div class="card um-card-container">
              <div class="um-employee-info">
                <div id="avatar-${emp.id}" style="width:52px; height:52px; border-radius:50%; background:var(--primary-light); color:var(--primary-color); display:flex; align-items:center; justify-content:center; font-size:1.35rem; font-weight:700; flex-shrink:0; overflow:hidden;">
                  ${emp.name.substring(0, 2).toUpperCase()}
                </div>
                <div style="min-width:0; flex:1;">
                  <div style="font-weight:700; color:var(--text-primary); font-size:1.05rem; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${emp.name}">${emp.name}</div>
                  <div style="font-size:0.8rem; color:var(--text-muted); display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:2px;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${emp.jabatan}</span>
                    ${emp.location && emp.location !== '-' ? `<span style="display:inline-flex; align-items:center; gap:3px; margin-left:4px; color:var(--primary-color); opacity:0.8;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg><span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 120px;">${emp.location}</span></span>` : ''}
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">
                    ${emp.department} &bull; NIK: ${emp.nik || '-'}
                  </div>
                </div>
              </div>
              
              <div class="um-action-group">
                ${isExisting ? `
                  <div style="display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:var(--success-light); color:var(--success); border-radius:8px; font-weight:600; font-size:0.8rem; height:36px; white-space:nowrap; box-sizing:border-box;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    Sudah Dibuat
                  </div>
                  <a href="${REAL_GLPI_URL}/front/user.form.php?id=${isExisting.id}" target="_blank" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; font-size:0.8rem; padding:0 16px; text-decoration:none; white-space:nowrap; background:var(--accent); color:white; border-radius:8px; font-weight:600; height:36px; transition:all 0.2s; box-shadow:0 2px 4px rgba(225,29,72,0.15); box-sizing:border-box;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    Lihat GLPI
                  </a>
                ` : `
                  <button class="btn btn-outline btn-make-user" data-id="${emp.id}" style="padding:0 16px; font-size:0.8rem; display:inline-flex; align-items:center; justify-content:center; gap:6px; height:36px; border-color:var(--primary-color); color:var(--primary-color); white-space:nowrap; box-sizing:border-box;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                    Buat User GLPI
                  </button>
                `}
              </div>
            </div>
          `;
        });
        cardGrid.innerHTML = gridHtml;

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

        // Bind Make User Button Listeners
        cardGrid.querySelectorAll('.btn-make-user').forEach(btn => {
          btn.addEventListener('click', () => {
            const emp = approved.find(e => e.id === btn.dataset.id);
            if (!emp) return;
            
            const parts = emp.name.trim().split(/\s+/);
            const firstName = parts[0];
            const lastName = parts.slice(1).join(' ');
            
            inpFn.value = firstName;
            inpLn.value = lastName;
            inpNik.value = emp.nik || '';
            inpEm.value = generateEmail(emp.name);
            inpPw.value = generateRandomPassword();
            inpSupervisor.value = '';
            statusUn.textContent = '';
            
            // Auto-select group
            selGroup.value = "";
            if (emp.department) {
              const matchG = glpiGroups.find(g => g.name.toLowerCase().includes(emp.department.toLowerCase()) || emp.department.toLowerCase().includes(g.name.toLowerCase()));
              if (matchG) selGroup.value = matchG.id;
            }

            // Auto-select location
            selLoc.value = "";
            if (emp.lokasi && glpiLocations.length > 0) {
              const matchL = glpiLocations.find(l => l.name.toLowerCase().includes(emp.lokasi.toLowerCase()) || emp.lokasi.toLowerCase().includes(l.name.toLowerCase()));
              if (matchL) selLoc.value = matchL.id;
            }
            
            modal.style.display = 'block';
            checkUsernameAvailability();
            validateForm();
          });
        });

        // Asynchronously load photos for CURRENT page items only
        pageItems.forEach(async (emp) => {
          const el = document.getElementById(`avatar-${emp.id}`);
          if (!el) return;
          try {
            let imageUrl = null;
            let downloadBlob = null;
            
            console.log(`[UserMaker Avatar] Loading photo for ${emp.name} (ID: ${emp.id}, ticketId: ${emp.ticketId}, status: ${emp.status})`);
            
            if (emp.status === 'approved' && emp.ticketId) {
              el.innerHTML = `
                <div class="spinner" style="width:14px;height:14px;border-width:2px;border-color:var(--primary-color);border-top-color:transparent;"></div>
              `;
              console.log(`[UserMaker Avatar] Trying fetchIDCardBlobURL(${emp.ticketId})...`);
              const idcardDoc = await fetchIDCardBlobURL(emp.ticketId);
              console.log(`[UserMaker Avatar] fetchIDCardBlobURL result:`, idcardDoc ? `objectURL=${!!idcardDoc.objectURL}, blobSize=${idcardDoc.blob?.size}` : 'null');
              if (idcardDoc && idcardDoc.objectURL) {
                imageUrl = idcardDoc.objectURL;
                downloadBlob = idcardDoc.blob;
              }
            }
            
            if (!imageUrl) {
              console.log(`[UserMaker Avatar] Trying getEmployee fallback for ${emp.id}...`);
              const empData = await getEmployee(emp.id);
              console.log(`[UserMaker Avatar] getEmployee result: processedPhoto=${!!empData?.processedPhoto}, photo=${!!empData?.photo}`);
              if (empData) {
                imageUrl = empData.processedPhoto || empData.photo;
              }
            }
            
            if (imageUrl) {
              console.log(`[UserMaker Avatar] ✅ Photo loaded for ${emp.name}`);
              el.innerHTML = `
                <img src="${imageUrl}" 
                     style="width:100%; height:100%; object-fit:cover; cursor:zoom-in; transition:transform 0.2s ease;" 
                     class="avatar-img-preview" 
                     title="Klik untuk melihat & download ID Card"
                     onmouseover="this.style.transform='scale(1.15)'"
                     onmouseout="this.style.transform='scale(1)'" />
              `;
              el.querySelector('img').addEventListener('click', (e) => {
                e.stopPropagation();
                showImagePopup(imageUrl, emp.name, downloadBlob || imageUrl);
              });
            } else {
              console.warn(`[UserMaker Avatar] ❌ No photo found for ${emp.name} — showing initials`);
              el.innerHTML = emp.name.substring(0, 2).toUpperCase();
            }
          } catch (err) {
            console.error(`[UserMaker Avatar] Failed to load avatar for ${emp.name}:`, err);
            el.innerHTML = emp.name.substring(0, 2).toUpperCase();
          }
        });
      }

      // Initial render
      updateUI();

      // Search Filtering
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const q = e.target.value.toLowerCase().trim();
          filtered = approved.filter(emp => {
            return !q || 
                   emp.name.toLowerCase().includes(q) || 
                   emp.jabatan.toLowerCase().includes(q) || 
                   (emp.department && emp.department.toLowerCase().includes(q)) || 
                   (emp.nik && emp.nik.toLowerCase().includes(q));
          });
          currentPage = 1;
          updateUI();
        });
      }

      // Popup handler helper
      function showImagePopup(src, employeeName, downloadSource) {
        // Remove existing popups
        const existing = document.getElementById('um-image-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'um-image-popup';
        popup.style = `
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.92);
          backdrop-filter: blur(8px);
          z-index: 100000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: fadeIn 0.2s ease-out;
        `;
        
        popup.innerHTML = `
          <div style="position:relative; max-width:90%; max-height:80%; display:flex; justify-content:center; align-items:center; border-radius:16px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.6);">
            <img id="popup-img-tag" src="${src}" style="max-width:100%; max-height:68vh; object-fit:contain; border-radius:12px; display:block;" />
            <button id="close-popup-btn" style="position:absolute; top:12px; right:12px; width:36px; height:36px; border-radius:50%; background:rgba(15,23,42,0.7); border:none; cursor:pointer; color:white; display:flex; align-items:center; justify-content:center; transition:background 0.2s; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div style="margin-top:20px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:12px;">
            <h3 style="color:white; margin:0; font-size:1.2rem; font-weight:700;">ID Card - ${employeeName}</h3>
            <button id="download-popup-btn" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:8px; padding:12px 28px; font-weight:600; border-radius:10px; font-size:0.9rem; transition:transform 0.15s ease;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Download ID Card PNG
            </button>
          </div>
        `;

        document.body.appendChild(popup);

        const closePopup = () => {
          popup.style.animation = 'fadeOut 0.2s ease-in';
          setTimeout(() => popup.remove(), 180);
        };
        
        popup.addEventListener('click', (e) => {
          if (e.target === popup) closePopup();
        });
        document.getElementById('close-popup-btn').addEventListener('click', closePopup);
        
        // Handle download click
        document.getElementById('download-popup-btn').addEventListener('click', () => {
          const filename = `idcard_${employeeName.toLowerCase().replace(/\s+/g, '_')}.png`;
          if (downloadSource instanceof Blob) {
            const url = URL.createObjectURL(downloadSource);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          } else {
            const a = document.createElement('a');
            a.href = src;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
          }
        });
      }

    } catch (err) {
      content.innerHTML = `<div class="empty-state" style="color:var(--rose);">Error loading data: ${err.message}</div>`;
    }

    // Dynamic Form Validation Logic
    function validateForm() {
      const fn = inpFn.value.trim();
      const ln = inpLn.value.trim();
      const em = inpEm.value.trim();
      const nik = inpNik.value.trim();
      const grp = selGroup.value;
      const loc = selLoc.value;
      const sup = inpSupervisor.value.trim();
      const pwd = inpPw.value.trim();
      
      // Enforce supervisor matches a valid GLPI user
      const isSupervisorValid = glpiUsers.some(u => u.name === sup);
      
      // Enforce username is checked and available
      const isUnameAvailable = statusUn.textContent.includes('tersedia');
      
      const allFilled = fn && ln && em && nik && grp && loc && sup && pwd && isSupervisorValid && isUnameAvailable;
      
      const btnSubmit = document.getElementById('btn-submit-user');
      if (btnSubmit) {
        if (allFilled) {
          btnSubmit.disabled = false;
          btnSubmit.style.opacity = '1';
          btnSubmit.style.cursor = 'pointer';
        } else {
          btnSubmit.disabled = true;
          btnSubmit.style.opacity = '0.5';
          btnSubmit.style.cursor = 'not-allowed';
        }
      }
    }

    // Username & NIK check logic
    async function checkUsernameAvailability() {
      const email = inpEm.value.trim();
      const nik = inpNik.value.trim();
      if (!email && !nik) {
        statusUn.textContent = ''; 
        validateForm();
        return;
      }
      statusUn.textContent = 'Memeriksa ketersediaan (User/NIK)...';
      statusUn.style.color = 'var(--text-muted)';
      validateForm(); // Disable while checking
      
      try {
        const exists = await checkGLPIUserExists(email, nik);
        if (exists) {
          statusUn.textContent = 'Email/Username atau NIK sudah terdaftar!';
          statusUn.style.color = 'var(--rose)';
        } else {
          statusUn.textContent = 'Username & NIK tersedia.';
          statusUn.style.color = 'var(--success)';
        }
      } catch (e) {
        statusUn.textContent = '';
      } finally {
        validateForm();
      }
    }

    // Attach input listeners for real-time button state validation
    inpFn.addEventListener('input', validateForm);
    inpLn.addEventListener('input', validateForm);
    
    inpEm.addEventListener('input', () => {
      validateForm();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkUsernameAvailability, 500);
    });
    
    inpNik.addEventListener('input', () => {
      validateForm();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkUsernameAvailability, 500);
    });

    selGroup.addEventListener('change', validateForm);
    selLoc.addEventListener('change', validateForm);
    
    inpSupervisor.addEventListener('input', validateForm);
    inpSupervisor.addEventListener('change', validateForm);

    // Modal actions
    document.getElementById('close-user-modal').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    document.getElementById('btn-regen-pwd').addEventListener('click', () => {
      inpPw.value = generateRandomPassword();
      validateForm();
    });

    // Submit User
    document.getElementById('form-create-user').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSubmit = document.getElementById('btn-submit-user');
      
      if (statusUn.textContent.includes('terdaftar')) {
        showToast('Gunakan Username atau NIK yang belum terpakai', 'error');
        return;
      }

      let supId = null;
      if (inpSupervisor.value) {
        const matchU = glpiUsers.find(u => u.name === inpSupervisor.value);
        if (matchU) supId = matchU.id;
      }

      const payload = {
        firstName: inpFn.value.trim(),
        lastName: inpLn.value.trim(),
        username: inpEm.value.trim(),
        nik: inpNik.value.trim(),
        password: inpPw.value.trim(),
        locations_id: selLoc.value ? parseInt(selLoc.value) : null,
        supervisor_id: supId
      };

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-color:white;border-top-color:transparent;margin-right:8px;"></div> Creating...';

      try {
        const userId = await createGLPIUser(payload);
        await addGLPIUserEmail(userId, payload.username);
        
        if (selGroup.value) {
          await addGLPIUserGroup(userId, parseInt(selGroup.value));
        }
        
        modal.style.display = 'none';
        
        // Show Credentials Popup
        document.getElementById('cred-name').textContent = `${payload.firstName} ${payload.lastName}`;
        document.getElementById('cred-uname').textContent = payload.username;
        document.getElementById('cred-pwd').textContent = payload.password;
        document.getElementById('creds-modal-backdrop').style.display = 'block';
        
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Create User';
      }
    });

    // Credentials Popup Logic
    const credsModal = document.getElementById('creds-modal-backdrop');
    document.getElementById('btn-close-creds').addEventListener('click', () => {
      credsModal.style.display = 'none';
      renderUserMaker(container); // RE-RENDER
    });
    
    document.getElementById('btn-copy-creds').addEventListener('click', () => {
      const name = document.getElementById('cred-name').textContent;
      const uname = document.getElementById('cred-uname').textContent;
      const pwd = document.getElementById('cred-pwd').textContent;
      
      const txt = `✨ KREDENSIAL AKUN GLPI BARU ✨\n\n` +
                  `Nama Karyawan  : ${name}\n` +
                  `Username/Email : ${uname}\n` +
                  `Password       : ${pwd}\n\n` +
                  `Akses Via : ${REAL_GLPI_URL}`;
      
      navigator.clipboard.writeText(txt).then(() => {
        showToast('Kredensial disalin ke clipboard!', 'success');
      });
    });
  }

  function showToast(msg, type='info') {
    if(window._toastModule) {
      window._toastModule.showToast(msg, type);
    } else {
      alert(msg);
    }
  }
}
