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
 * Dynamic font size for name.
 * Logic: if name wraps to 2 lines, font can be LARGER (more vertical space).
 * Word count helps determine wrapping: fewer words → bigger font.
 */
function getNameFontSize(name) {
  const len = (name || '').trim().length;
  const words = (name || '').trim().split(/\s+/).length;

  // Very short names — big & bold, fits 1 line
  if (len <= 10) return '2.4rem';

  // Short names, 1–2 words
  if (len <= 16) return '2.1rem';

  // Medium names — likely 2 lines, can still be large
  if (len <= 22) return '1.9rem';

  // 3–5 word names wrapping to 2 lines — this is the sweet spot
  // Give them a larger font because 2 lines have plenty of room
  if (len <= 32) {
    // If 3–4 words, each line has fewer chars → can be bigger
    if (words <= 4) return '1.75rem';
    return '1.6rem';
  }

  // Very long names
  if (len <= 42) return '1.45rem';
  return '1.25rem'; // extremely long, keep readable
}

function getJobFontSize(job) {
  const len = (job || '').length;
  if (len <= 16) return '1.25rem';  // Short job title — bigger
  if (len <= 25) return '1.12rem';  // 1–2 words
  if (len <= 35) return '1.0rem';   // 2 lines
  return '0.9rem';                  // Very long
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
