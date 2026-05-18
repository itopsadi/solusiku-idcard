import './idcard.css';

/** Generate dot grid HTML */
function dotGrid(count) {
  return Array.from({ length: count }, () => '<span class="dot"></span>').join('');
}

// Persisted custom logo
let _logoDataURL = null;
export function setLogo(dataURL) { 
  _logoDataURL = dataURL; 
  localStorage.setItem('solusiku_logo', dataURL);
}
export function getLogo() { 
  if (!_logoDataURL) {
    _logoDataURL = localStorage.getItem('solusiku_logo');
  }
  return _logoDataURL; 
}

/**
 * Dynamic font size for name based on character length.
 * Matches reference: short names are big & bold, long names scale down.
 */
function getNameFontSize(name) {
  const len = (name || '').length;
  // Memungkinkan nama yang lebih panjang untuk tetap besar karena sekarang dibungkus 2 baris
  if (len <= 12) return '2.0rem';   // Cukup pendek untuk 1 baris
  if (len <= 20) return '1.75rem';  // Pas untuk 2 baris
  if (len <= 30) return '1.45rem';  // Nama 3-4 kata panjang
  return '1.25rem';                 // Tetap terbaca walau sangat panjang
}

function getJobFontSize(job) {
  const len = (job || '').length;
  if (len <= 20) return '1.15rem';  // Standar, muat 1 baris
  if (len <= 35) return '1.05rem';  // 2 baris
  return '0.95rem';                 // Sangat panjang
}

/**
 * Build the logo HTML:
 * Uses the uploaded logo image (persisted in localStorage).
 * No hardcoded text.
 */
function buildLogoHTML(customSrc) {
  if (customSrc) {
    return '<img src="' + customSrc + '" alt="Solusiku Logo" style="height:40px;width:auto;object-fit:contain"/>';
  }
  return '<div style="font-size:0.75rem;color:#999;border:1px dashed #ccc;padding:4px 8px;border-radius:4px;white-space:nowrap;">Upload Logo via Dashboard</div>';
}

/**
 * Render Solusiku ID Card — exact reference match:
 *  ✓ Large gray circle LEFT-aligned (bleeds off left edge)
 *  ✓ Gray rectangle + white dots at bottom-left
 *  ✓ Red blob top-right with 3×3 white dots
 *  ✓ Static combined logo SVG (icon + SOLUSIKU text)
 *  ✓ Photo = transparent bg, overflows circle
 *  ✓ Name = dynamic font size by length, very bold black
 *  ✓ Job title = red, medium weight, not italic, slightly larger
 *  ✓ NIK = bottom-right, larger, gray
 */
export function renderIDCard(data) {
  const card = document.createElement('div');
  card.className = 'idcard';

  const photoSrc = data.photo;
  const name     = data.name    || 'Nama Karyawan';
  const jabatan  = data.jabatan || 'Jabatan';
  const nik      = data.nik     || 'ADI-0000-000';

  // Dynamic name font size
  const nameFontSize = getNameFontSize(name);

  const panX = data.panX || 0;
  const panY = data.panY || 0;
  const bgPos = `calc(50% + ${panX}px) calc(100% + ${panY}px)`;

  const photoHTML = photoSrc
    ? [
        `<div class="idcard-photo-clip" style="background-image: url('${photoSrc}'); background-position: ${bgPos}"></div>`,
        `<div class="idcard-photo-pop" style="background-image: url('${photoSrc}'); background-position: ${bgPos}"></div>`
      ].join('')
    : [
        '<div class="idcard-photo-placeholder">',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">',
        '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>',
        '<circle cx="12" cy="7" r="4"/>',
        '</svg>',
        '</div>',
      ].join('');

  const logoHTML = buildLogoHTML(getLogo());

  card.innerHTML = [
    // ── Background layer ──
    '<div class="idcard-bg">',
    '  <div class="idcard-circle-bg"></div>',
    '  <div class="idcard-blob-tr"></div>',
    '  <div class="idcard-dots-tr">' + dotGrid(9) + '</div>',
    '  <div class="idcard-bottom-deco"></div>',
    '  <div class="idcard-dots-bl">' + dotGrid(12) + '</div>',
    '</div>',

    // ── Content layer ──
    '<div class="idcard-content">',

    // Header: combined logo
    '  <div class="idcard-header">',
    '    ' + logoHTML,
    '  </div>',

    // Photo (transparent bg, sits on circle)
    '  <div class="idcard-photo-wrapper">',
    '    ' + photoHTML,
    '  </div>',

    // Name (dynamic size) + Job title (dynamic size)
    '  <div class="idcard-info">',
    '    <div class="idcard-name" style="font-size:' + nameFontSize + '">' + name + '</div>',
    '    <div class="idcard-jabatan" style="font-size:' + getJobFontSize(jabatan) + '">' + jabatan + '</div>',
    '  </div>',

    // NIK bottom-right
    '  <div class="idcard-footer">',
    '    <div class="idcard-nik">' + nik + '</div>',
    '  </div>',

    '</div>',
  ].join('\n');

  return card;
}
