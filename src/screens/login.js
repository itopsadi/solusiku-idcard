import { loginUser } from '../services/api.js';
import { showToast } from '../utils/toast.js';
import { navigate } from '../utils/router.js';

export function renderLogin(container) {
  // Ensure the app knows we are logged out (hides sidebar)
  document.body.classList.add('logged-out');

  let savedUsernames = [];
  try {
    savedUsernames = JSON.parse(localStorage.getItem('solusiku_saved_usernames') || '[]');
  } catch(e) {}
  
  const datalistOptions = savedUsernames.map(u => `<option value="${u}">`).join('');

  container.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-primary); width: 100%;">
      <div class="card animate-in" style="width: 100%; max-width: 420px; padding: 40px; text-align: center; box-shadow: var(--shadow-lg);">
        
        <div style="width: 64px; height: 64px; background: var(--gradient-1); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; color: white; margin: 0 auto 24px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 32px; height: 32px;"><rect x="2" y="4" width="20" height="16" rx="3"/><circle cx="12" cy="11" r="3"/><path d="M6 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1"/></svg>
        </div>

        <h1 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">IT OPS - SOLUSIKU</h1>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 8px; font-weight: 500;">ID Card Control Center</p>
        <p style="color: var(--text-muted); font-size: 0.75rem; margin-bottom: 32px;">Login menggunakan akun GLPI</p>

        <form id="login-form" style="display: flex; flex-direction: column; gap: 16px; text-align: left;">
          <div>
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">Username</label>
            <input type="text" id="login-username" required autocomplete="username" list="username-history"
              style="width: 100%; padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); outline: none; transition: all 0.2s; font-family: var(--font-sans);" 
              placeholder="Masukkan username GLPI"/>
            <datalist id="username-history">
              ${datalistOptions}
            </datalist>
          </div>

          <div>
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">Password</label>
            <input type="password" id="login-password" required autocomplete="current-password"
              style="width: 100%; padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); outline: none; transition: all 0.2s; font-family: var(--font-sans);" 
              placeholder="••••••••"/>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-secondary); cursor: pointer;">
              <input type="checkbox" id="remember-me" checked style="accent-color: var(--accent); width: 16px; height: 16px; cursor: pointer;"/>
              Ingat Saya
            </label>
          </div>

          <button type="submit" id="btn-submit" class="btn btn-primary btn-lg" style="margin-top: 12px; width: 100%;">
            Masuk ke Dashboard
          </button>
        </form>

        <div style="font-size: 0.65rem; color: var(--text-muted); opacity: 0.6; text-align: center; margin-top: 32px;">
          Powered By IT Operations ADI - HG
        </div>
      </div>
    </div>
  `;

  // Focus styles
  const inputs = container.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('focus', () => input.style.borderColor = 'var(--accent)');
    input.addEventListener('blur', () => input.style.borderColor = 'var(--border)');
  });

  const form = container.querySelector('#login-form');
  const btnSubmit = container.querySelector('#btn-submit');
  const usernameInput = container.querySelector('#login-username');
  const passwordInput = container.querySelector('#login-password');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = container.querySelector('#remember-me').checked;

    if (!username || !password) return;

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;border-top-color:#fff;"></div> Memverifikasi...';

    try {
      const success = await loginUser(username, password, rememberMe);
      if (success) {
        showToast('Login berhasil!', 'success');
        
        if (!savedUsernames.includes(username)) {
          savedUsernames.push(username);
          localStorage.setItem('solusiku_saved_usernames', JSON.stringify(savedUsernames));
        }

        try {
          let pStr = localStorage.getItem('solusiku_user_profile');
          if (!pStr) pStr = sessionStorage.getItem('solusiku_user_profile');
          if (pStr) {
            const p = JSON.parse(pStr);
            const nameEl = document.querySelector('.user-name');
            const roleEl = document.querySelector('.user-role');
            const avatarEl = document.querySelector('.user-avatar');
            if (nameEl) nameEl.textContent = p.name;
            if (roleEl) roleEl.textContent = p.role;
            if (avatarEl) avatarEl.textContent = p.avatar;
            
            // Role-based UI
            const isSuperAdmin = (p.role || '').toLowerCase().includes('super-admin');
            if (isSuperAdmin) {
              document.body.classList.add('is-super-admin');
            } else {
              document.body.classList.remove('is-super-admin');
            }
          }
        } catch (e) {}

        document.body.classList.remove('logged-out');
        
        // Clear old caches and hard reload for fresh assets
        try {
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (const name of cacheNames) {
              await caches.delete(name);
            }
          }
        } catch (cacheErr) {
          console.warn('Cache clear on login failed:', cacheErr);
        }
        
        // Hard reload to dashboard with clean state
        window.location.href = window.location.pathname + '#/';
        window.location.reload(true);
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Terjadi kesalahan jaringan.', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = 'Masuk ke Dashboard';
    }
  });
}
