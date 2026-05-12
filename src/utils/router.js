// Simple hash-based SPA router
const routes = {};
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getParams() {
  const hash = window.location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  return { parts, full: hash };
}

async function handleRoute() {
  const hash = window.location.hash.slice(1) || '/';
  const container = document.getElementById('page-container');
  if (!container) return;

  // ROUTE PROTECTION
  const sessionToken = localStorage.getItem('solusiku_user_session') || sessionStorage.getItem('solusiku_user_session');
  if (!sessionToken && hash !== '/login') {
    window.location.hash = '/login';
    return;
  }
  if (sessionToken && hash === '/login') {
    window.location.hash = '/';
    return;
  }

  // Cleanup previous screen
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  // Fade out
  container.style.opacity = '0';
  container.style.transform = 'translateY(8px)';

  await new Promise(r => setTimeout(r, 150));

  // Match route
  let matched = false;
  for (const [pattern, handler] of Object.entries(routes)) {
    const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$');
    const match = hash.match(regex);
    if (match) {
      const params = match.slice(1);
      const cleanup = await handler(container, ...params);
      if (typeof cleanup === 'function') currentCleanup = cleanup;
      matched = true;
      break;
    }
  }

  if (!matched && routes['/']) {
    const cleanup = await routes['/'](container);
    if (typeof cleanup === 'function') currentCleanup = cleanup;
  }

  // Fade in
  requestAnimationFrame(() => {
    container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
  });

  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === '#' + hash || (hash !== '/' && link.getAttribute('href') === '#/'));
  });
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
