// Mock data layer + GLPI Integration
const STORAGE_KEY = 'solusiku_idcard_data';

const GLPI_API_URL = import.meta.env.VITE_GLPI_API_URL;
const GLPI_APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN;

const DEFAULT_EMPLOYEES = [
  {
    id: 'emp001',
    name: 'Ahmad Fauzan Rizky',
    jabatan: 'Software Engineer',
    nik: 'NIK-2026-0511',
    department: 'IT Development',
    status: 'waiting_photo',
    ticketId: 'GLPI-1042',
    createdAt: '2026-05-10T08:00:00',
    photo: null,
    processedPhoto: null,
  },
  {
    id: 'emp002',
    name: 'Siti Nurhaliza',
    jabatan: 'UI/UX Designer',
    nik: 'NIK-2026-0512',
    department: 'Creative',
    status: 'waiting_photo',
    ticketId: 'GLPI-1043',
    createdAt: '2026-05-10T09:00:00',
    photo: null,
    processedPhoto: null,
  },
  {
    id: 'emp003',
    name: 'Budi Santoso',
    jabatan: 'Network Administrator',
    nik: 'NIK-2026-0513',
    department: 'IT Infrastructure',
    status: 'waiting_photo',
    ticketId: 'GLPI-1044',
    createdAt: '2026-05-10T10:30:00',
    photo: null,
    processedPhoto: null,
  },
  {
    id: 'emp004',
    name: 'Dewi Kartika Sari',
    jabatan: 'HR Specialist',
    nik: 'NIK-2026-0514',
    department: 'Human Resources',
    status: 'waiting_photo',
    ticketId: 'GLPI-1045',
    createdAt: '2026-05-11T07:00:00',
    photo: null,
    processedPhoto: null,
  },
  {
    id: 'emp005',
    name: 'Reza Mahendra',
    jabatan: 'System Analyst',
    nik: 'NIK-2026-0515',
    department: 'IT Development',
    status: 'waiting_photo',
    ticketId: 'GLPI-1046',
    createdAt: '2026-05-11T08:00:00',
    photo: null,
    processedPhoto: null,
  },
  {
    id: 'emp006',
    name: 'Putri Amelia',
    jabatan: 'Finance Officer',
    nik: 'NIK-2026-0516',
    department: 'Finance',
    status: 'ready_review',
    ticketId: 'GLPI-1040',
    createdAt: '2026-05-09T14:00:00',
    photo: null,
    processedPhoto: null,
  },
];

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [...DEFAULT_EMPLOYEES];
}

function saveData(data) {
  // Don't save photo blobs to localStorage (too large)
  const cleaned = data.map(e => ({ ...e, photo: e.photo ? '[photo]' : null, processedPhoto: e.processedPhoto ? '[processed]' : null }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
}

// In-memory store for employee metadata
let employees = [];
let dataLoaded = false;

// --- IndexedDB Setup for Large Photos ---
const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open('SolusikuIDCardDB', 1);
  request.onupgradeneeded = (e) => {
    e.target.result.createObjectStore('photos');
  };
  request.onsuccess = (e) => resolve(e.target.result);
  request.onerror = (e) => reject(e.target.error);
});

async function savePhotoDB(key, dataURL) {
  const db = await dbPromise;
  return new Promise((resolve) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').put(dataURL, key);
    tx.oncomplete = () => resolve();
  });
}

async function getPhotoDB(key) {
  const db = await dbPromise;
  return new Promise((resolve) => {
    const tx = db.transaction('photos', 'readonly');
    const req = tx.objectStore('photos').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function deletePhotoDB(key) {
  const db = await dbPromise;
  return new Promise((resolve) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').delete(key);
    tx.oncomplete = () => resolve();
  });
}

async function clearPhotosDB() {
  const db = await dbPromise;
  return new Promise((resolve) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').clear();
    tx.oncomplete = () => resolve();
  });
}

let glpiSessionToken = null;

export async function loginUser(username, password, rememberMe = true) {
  try {
    const credentials = btoa(`${username}:${password}`);
    const res = await fetch(`${GLPI_API_URL}/initSession`, {
      method: 'GET',
      headers: {
        'App-Token': GLPI_APP_TOKEN,
        'Authorization': `Basic ${credentials}`
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('InitSession Error:', res.status, errorText);
      if (res.status === 401) throw new Error('Username/Password salah (401). Pastikan "Enable login with credentials" AKTIF di GLPI.');
      throw new Error(`Login gagal (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    const sessionToken = data.session_token;

    // VALIDATE GROUP & PROFILE
    const fullSessionRes = await fetch(`${GLPI_API_URL}/getFullSession`, {
      headers: {
        'App-Token': GLPI_APP_TOKEN,
        'Session-Token': sessionToken
      }
    });

    if (!fullSessionRes.ok) throw new Error('Gagal memuat profil pengguna');
    const sessionData = await fullSessionRes.json();
    const userId = sessionData.session.glpiID;

    if (!userId) throw new Error('ID Pengguna tidak valid');

    // --- ADMIN BYPASS FOR GROUP CHECK ---
    // We initialize a temporary admin session to bypass 403/400 errors
    let adminSessionToken = null;
    const adminUserToken = import.meta.env.VITE_GLPI_USER_TOKEN;

    console.log('[Auth] Admin Token Configured:', adminUserToken ? 'YES (Starts with ' + adminUserToken.substring(0, 4) + '...)' : 'NO');

    if (adminUserToken) {
      try {
        const adminSessionRes = await fetch(`${GLPI_API_URL}/initSession`, {
          headers: {
            'App-Token': GLPI_APP_TOKEN,
            'Authorization': `user_token ${adminUserToken}`
          }
        });
        if (adminSessionRes.ok) {
          const adminSessionData = await adminSessionRes.json();
          adminSessionToken = adminSessionData.session_token;
          console.log('[Auth] Admin Session Init: SUCCESS');
        } else {
          const errText = await adminSessionRes.text();
          console.error('[Auth] Admin Session Init: FAILED', adminSessionRes.status, errText);
        }
      } catch (e) {
        console.error('[Auth] Admin Init Exception:', e);
      }
    }

    console.log('[Auth] Using Token for Group Check:', adminSessionToken ? 'ADMIN SESSION' : 'USER SESSION (Fallback)');

    const secureHeaders = {
      'App-Token': GLPI_APP_TOKEN,
      'Session-Token': adminSessionToken || sessionToken
    };

    // --- AUTH VALIDATION LOGIC ---
    let allowed = false;
    let allowedGroupName = '';

    const checkName = (name) => {
      if (!name) return false;
      const n = name.toString().toLowerCase();
      return n.includes('it operation') || n.includes('it ops') || n.includes('it op') || 
             n.includes('hrga') || n.includes('human resource') || n.includes('hr') || 
             n.includes('general affair') || n.includes('ga') || n.includes('admin') || 
             n.includes('super-admin') || n.includes('technician') || n.includes('teknisi');
    };

    // METHOD 1: Search API (Using Secure Headers)
    const groupsRes = await fetch(`${GLPI_API_URL}/search/Group_User?criteria[0][field]=2&criteria[0][searchtype]=equals&criteria[0][value]=${userId}&expand_dropdowns=true`, {
      headers: secureHeaders
    });

    if (groupsRes.ok) {
      const groupsData = await groupsRes.json();
      const dataRows = (groupsData && groupsData.data) ? groupsData.data : (Array.isArray(groupsData) ? groupsData : []);
      if (Array.isArray(dataRows)) {
        for (const g of dataRows) {
          let val = g['1'] || g.name || '';
          let rawName = (typeof val === 'object' && val !== null) ? (val.name || '') : val;
          console.log('[Auth] Method 1 - Group Found:', rawName);
          if (checkName(rawName)) {
            allowed = true;
            allowedGroupName = rawName;
            break;
          }
        }
      }
    }

    // METHOD 2: Direct User-Group API (Using Secure Headers)
    if (!allowed) {
      try {
        const directGroupsRes = await fetch(`${GLPI_API_URL}/User/${userId}/Group/`, {
          headers: secureHeaders
        });
        if (directGroupsRes.ok) {
          const directGroups = await directGroupsRes.json();
          for (const dg of (Array.isArray(directGroups) ? directGroups : [])) {
            console.log('[Auth] Method 2 - Group Found:', dg.name);
            if (checkName(dg.name)) {
              allowed = true;
              allowedGroupName = dg.name;
              break;
            }
          }
        }
      } catch (e) {
        console.error('[Auth] Method 2 Failed:', e);
      }
    }

    // METHOD 3: Active Profile Fallback
    const activeProfile = (sessionData.session.glpiactiveprofile || {}).name || '';
    console.log('[Auth] Active Profile:', activeProfile);
    if (!allowed && checkName(activeProfile)) {
      allowed = true;
    }

    // Cleanup Admin Session if used
    if (adminSessionToken) {
      fetch(`${GLPI_API_URL}/killSession`, {
        method: 'GET',
        headers: { 'App-Token': GLPI_APP_TOKEN, 'Session-Token': adminSessionToken }
      }).catch(() => {});
    }

    if (!allowed) {
      await fetch(`${GLPI_API_URL}/killSession`, {
        method: 'GET',
        headers: { 'App-Token': GLPI_APP_TOKEN, 'Session-Token': sessionToken }
      });
      throw new Error('Akses ditolak: User Anda tidak berada di Grup IT/HR/GA.');
    }

    // Ekstrak info profil pengguna untuk UI
    const firstName = sessionData.session.glpifirstname || '';
    const lastName = sessionData.session.glpirealname || '';
    let fullName = `${firstName} ${lastName}`.trim();
    if (!fullName) fullName = sessionData.session.glpiname || 'User';

    const avatar = fullName.substring(0, 2).toUpperCase();
    let displayRole = activeProfile || 'User';

    const userProfile = {
      name: fullName,
      avatar: avatar,
      role: allowedGroupName ? `${allowedGroupName} • ${displayRole}` : displayRole
    };

    if (rememberMe) {
      localStorage.setItem('solusiku_user_profile', JSON.stringify(userProfile));
      localStorage.setItem('solusiku_user_session', sessionToken);
    } else {
      sessionStorage.setItem('solusiku_user_profile', JSON.stringify(userProfile));
      sessionStorage.setItem('solusiku_user_session', sessionToken);
    }

    glpiSessionToken = sessionToken;
    return true;

  } catch (err) {
    throw err;
  }
}

export function logoutUser() {
  const sessionToken = localStorage.getItem('solusiku_user_session') || sessionStorage.getItem('solusiku_user_session');
  if (sessionToken) {
    fetch(`${GLPI_API_URL}/killSession`, {
      method: 'GET',
      headers: { 'App-Token': GLPI_APP_TOKEN, 'Session-Token': sessionToken }
    }).catch(() => { });
  }
  localStorage.removeItem('solusiku_user_session');
  localStorage.removeItem('solusiku_user_profile');
  sessionStorage.removeItem('solusiku_user_session');
  sessionStorage.removeItem('solusiku_user_profile');
  glpiSessionToken = null;
}

export async function getSession() {
  if (glpiSessionToken) return glpiSessionToken;
  let stored = localStorage.getItem('solusiku_user_session');
  if (!stored) stored = sessionStorage.getItem('solusiku_user_session');
  if (stored) {
    glpiSessionToken = stored;
    return stored;
  }
  return null;
}

export async function fetchGLPITickets() {
  // Use mock data if GLPI is not configured
  if (!GLPI_API_URL || GLPI_API_URL.includes('localhost:8080')) {
    console.log('[GLPI] Using mock data (GLPI not configured)');
    employees = loadData();
    dataLoaded = true;
    return employees;
  }

  const session = await getSession();
  if (!session) {
    employees = loadData();
    dataLoaded = true;
    return employees;
  }

  try {
    const res = await fetch(`${GLPI_API_URL}/Ticket?range=0-100&expand_dropdowns=true&sort=id&order=DESC`, {
      headers: {
        'App-Token': GLPI_APP_TOKEN,
        'Session-Token': session
      }
    });
    const tickets = await res.json();
    if (!Array.isArray(tickets)) throw new Error('Invalid response');

    // Load existing data to preserve local photo states
    const localData = loadData();

    // Filter tiket onboarding (Device Request) yang berstatus Assigned (2), Solved (5), atau Closed (6)
    const onboardingTickets = tickets.filter(t => {
      const title = t.name || '';
      return title.toLowerCase().includes('device request') && [2, 5, 6].includes(t.status);
    });

    const glpiEmployees = onboardingTickets.map(t => {
      const id = `glpi-${t.id}`;
      const existing = localData.find(e => e.id === id) || {};

      // --- SMART PARSER FORM ONBOARDING ---
      // Konversi <br> menjadi newline, lalu hapus sisa tag HTML tanpa menambah newline ekstra
      const contentText = (t.content || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]*>?/gm, '');

      const nameMatch = contentText.match(/1\)\s*Nama Lengkap Karyawan\s*:\s*([^\n]+)/i);
      const nikMatch = contentText.match(/2\)\s*Kode Karyawan Baru\s*:\s*([^\n]+)/i);
      const deptMatch = contentText.match(/3\)\s*Departement Karyawan\s*:\s*([^\n]+)/i);
      const jabatanMatch = contentText.match(/4\)\s*Jabatan Karyawan\s*:\s*([^\n]+)/i);
      const lokasiMatch = contentText.match(/(?:Lokasi|Penempatan)[\s\w]*:\s*([^\n]+)/i);

      let empName = nameMatch ? nameMatch[1].trim() : (t.users_id_recipient || t.name);
      // Clean email if fallback
      if (empName && empName.includes('@')) empName = empName.split('@')[0].replace(/\./g, ' ');
      // Title Case
      empName = empName.replace(/\b\w/g, c => c.toUpperCase());

      // If status is closed or solved in GLPI, force local status to 'approved'
      let finalStatus = existing.status || 'waiting_photo';
      if (t.status === 5 || t.status === 6) {
        finalStatus = 'approved';
      }

      return {
        id: id,
        name: empName,
        jabatan: jabatanMatch ? jabatanMatch[1].trim() : (t.itilcategories_id || 'Staff'),
        nik: nikMatch ? nikMatch[1].trim() : `GLPI-${t.id}`,
        department: deptMatch ? deptMatch[1].trim() : (t.entities_id || '-'),
        location: lokasiMatch ? lokasiMatch[1].trim() : '-',
        status: finalStatus,
        ticketId: `GLPI-${t.id}`,
        createdAt: t.date || new Date().toISOString(),
        photo: existing.photo || null,
        processedPhoto: existing.processedPhoto || null,
      };
    });

    employees = glpiEmployees;
    saveData(employees);
    dataLoaded = true;
    return employees;
  } catch (err) {
    console.error('[GLPI] Fetch Error:', err);
    employees = loadData();
    dataLoaded = true;
    return employees;
  }
}

export async function getEmployees(force = false) {
  if (!dataLoaded || force) await fetchGLPITickets();
  return [...employees];
}

export async function getEmployee(id) {
  if (!dataLoaded) await fetchGLPITickets();
  const emp = employees.find(e => e.id === id);
  if (!emp) return null;

  let photo = await getPhotoDB(`${id}_photo`);
  let processedPhoto = await getPhotoDB(`${id}_processed`);

  // SINKRONISASI CLOUD: Jika foto hasil proses (ID Card) hilang di lokal tapi tiketnya dari GLPI,
  // coba tarik lampiran dokumen dari GLPI.
  if (!processedPhoto && id.startsWith('glpi-')) {
    console.log('[Sync] Foto lokal tidak ditemukan, mencoba sinkronisasi dari GLPI...');
    const ticketId = id.replace('glpi-', '');
    const cloudPhoto = await fetchIDCardFromGLPI(ticketId);
    if (cloudPhoto) {
      console.log('[Sync] Berhasil mendownload ID Card dari GLPI.');
      processedPhoto = cloudPhoto;
      // Simpan ke lokal (IndexedDB) agar pembukaan berikutnya lebih cepat
      await savePhotoDB(`${id}_processed`, cloudPhoto);
    }
  }

  return {
    ...emp,
    photo,
    processedPhoto,
  };
}

async function fetchIDCardFromGLPI(ticketId) {
  const session = await getSession();
  if (!session || !GLPI_API_URL) return null;

  try {
    // 1. Cari dokumen yang terhubung ke tiket ini
    const docItemRes = await fetch(`${GLPI_API_URL}/Ticket/${ticketId}/Document`, {
      headers: { 'App-Token': GLPI_APP_TOKEN, 'Session-Token': session }
    });

    if (!docItemRes.ok) return null;
    const documents = await docItemRes.json();
    
    // Cari dokumen yang namanya mengandung 'idcard' dan formatnya png/jpg
    const idCardDoc = documents.find(doc => 
      doc.name.toLowerCase().includes('id card') || 
      doc.filename.toLowerCase().includes('idcard')
    );

    if (!idCardDoc) return null;

    // 2. Download file aslinya
    // Di GLPI API, GET /Document/:id mengembalikan file jika kita tambahkan parameter alt=media
    const fileRes = await fetch(`${GLPI_API_URL}/Document/${idCardDoc.id}?alt=media`, {
      headers: { 'App-Token': GLPI_APP_TOKEN, 'Session-Token': session }
    });

    if (!fileRes.ok) return null;
    const blob = await fileRes.blob();

    // 3. Konversi Blob ke DataURL (Base64) agar bisa langsung ditampilkan di <img>
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

  } catch (err) {
    console.error('[Sync] Gagal sinkronisasi foto dari GLPI:', err);
    return null;
  }
}

export function updateEmployee(id, updates) {
  const idx = employees.findIndex(e => e.id === id);
  if (idx === -1) return null;
  employees[idx] = { ...employees[idx], ...updates };
  saveData(employees);
  return employees[idx];
}

export async function savePhoto(id, photoDataURL) {
  await savePhotoDB(`${id}_photo`, photoDataURL);
  updateEmployee(id, { photo: '[photo]', status: 'processing' });
}

export async function saveProcessedPhoto(id, photoDataURL) {
  await savePhotoDB(`${id}_processed`, photoDataURL);
  updateEmployee(id, { processedPhoto: '[processed]', status: 'ready_review' });
}

export function approveEmployee(id) {
  updateEmployee(id, { status: 'approved', approvedAt: new Date().toISOString() });
}

export async function resetEmployee(id) {
  await deletePhotoDB(`${id}_photo`);
  await deletePhotoDB(`${id}_processed`);
  updateEmployee(id, { photo: null, processedPhoto: null, status: 'waiting_photo' });
}

export async function getStats() {
  if (!dataLoaded) await fetchGLPITickets();
  const total = employees.length;
  const waiting = employees.filter(e => e.status === 'waiting_photo').length;
  const processing = employees.filter(e => e.status === 'processing').length;
  const ready = employees.filter(e => e.status === 'ready_review').length;
  const approved = employees.filter(e => e.status === 'approved').length;
  return { total, waiting, processing, ready, approved };
}

export async function resetAllData() {
  employees = [];
  dataLoaded = false;
  await clearPhotosDB();
  localStorage.removeItem(STORAGE_KEY);
}

export async function uploadToGLPI(ticketId, blob) {
  if (!GLPI_API_URL || GLPI_API_URL.includes('localhost') || !glpiSessionToken) {
    console.warn('GLPI not configured or no session, skipping upload.');
    return false;
  }
  try {
    const formData = new FormData();
    const manifest = {
      input: {
        name: `ID Card - ${ticketId}`,
        _filename: [`idcard_${ticketId}.png`]
      }
    };
    formData.append('uploadManifest', JSON.stringify(manifest));
    formData.append('filename[0]', blob, `idcard_${ticketId}.png`);

    // 1. Upload Document
    const docRes = await fetch(`${GLPI_API_URL}/Document`, {
      method: 'POST',
      headers: {
        'App-Token': GLPI_APP_TOKEN,
        'Session-Token': glpiSessionToken
      },
      body: formData
    });

    if (!docRes.ok) throw new Error('Document upload failed');
    const docData = await docRes.json();
    const docId = docData.id;

    const ticketNum = ticketId.replace('GLPI-', '');

    // 2. Link Document to Ticket
    await fetch(`${GLPI_API_URL}/Document_Item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'App-Token': GLPI_APP_TOKEN,
        'Session-Token': glpiSessionToken
      },
      body: JSON.stringify({
        input: { documents_id: docId, items_id: ticketNum, itemtype: 'Ticket' }
      })
    });

    // 3. Mark Ticket as Solved (status 5)
    await fetch(`${GLPI_API_URL}/Ticket/${ticketNum}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'App-Token': GLPI_APP_TOKEN,
        'Session-Token': glpiSessionToken
      },
      body: JSON.stringify({
        input: { id: ticketNum, status: 5 }
      })
    });

    return true;
  } catch (err) {
    console.error('[GLPI Writeback Error]', err);
    return false;
  }
}

export async function uploadGlobalLogo(dataURL) {
  const session = await getSession();
  if (!GLPI_API_URL || GLPI_API_URL.includes('localhost') || !session) return false;

  try {
    // 1. Cek apakah tiket config sudah ada
    const searchRes = await fetch(`${GLPI_API_URL}/search/Ticket?criteria[0][field]=1&criteria[0][searchtype]=contains&criteria[0][value]=SOLUSIKU_APP_CONFIG`, {
      headers: { 'App-Token': GLPI_APP_TOKEN, 'Session-Token': session }
    });
    const searchData = await searchRes.json();

    // Kita simpan base64 string dalam tag HTML agar tidak rusak
    const contentPayload = `<!--LOGO_START-->${dataURL}<!--LOGO_END-->`;

    if (searchData.totalcount > 0) {
      // Update tiket yang sudah ada
      const ticketId = searchData.data[0]['2'];
      const updateRes = await fetch(`${GLPI_API_URL}/Ticket/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'App-Token': GLPI_APP_TOKEN,
          'Session-Token': session
        },
        body: JSON.stringify({
          input: { id: ticketId, content: contentPayload }
        })
      });
      return updateRes.ok;
    } else {
      // Buat tiket baru
      const createRes = await fetch(`${GLPI_API_URL}/Ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'App-Token': GLPI_APP_TOKEN,
          'Session-Token': session
        },
        body: JSON.stringify({
          input: {
            name: 'SOLUSIKU_APP_CONFIG',
            content: contentPayload,
            status: 5 // Closed/Solved
          }
        })
      });
      return createRes.ok;
    }
  } catch (err) {
    console.error('[GLPI Logo Sync Error]', err);
    return false;
  }
}

export async function fetchGlobalLogo() {
  const session = await getSession();
  if (!GLPI_API_URL || GLPI_API_URL.includes('localhost') || !session) return null;

  try {
    const searchRes = await fetch(`${GLPI_API_URL}/search/Ticket?criteria[0][field]=1&criteria[0][searchtype]=contains&criteria[0][value]=SOLUSIKU_APP_CONFIG&sort=id&order=DESC`, {
      headers: { 'App-Token': GLPI_APP_TOKEN, 'Session-Token': session }
    });
    const searchData = await searchRes.json();
    if (!searchData.data || searchData.data.length === 0) return null;

    const ticketId = searchData.data[0]['2'];

    const ticketRes = await fetch(`${GLPI_API_URL}/Ticket/${ticketId}`, {
      headers: { 'App-Token': GLPI_APP_TOKEN, 'Session-Token': session }
    });

    if (!ticketRes.ok) return null;
    const ticketData = await ticketRes.json();

    const content = ticketData.content || '';
    const match = content.match(/<!--LOGO_START-->(.*?)<!--LOGO_END-->/);
    if (match && match[1]) {
      return match[1]; // Mengembalikan dataURL base64 utuh
    }
    return null;
  } catch (err) {
    console.error('[GLPI Logo Fetch Error]', err);
    return null;
  }
}
