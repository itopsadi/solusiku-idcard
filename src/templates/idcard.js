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
 * Dynamic font size and line config for name.
 * Rules:
 *  - ≤ 20 chars (incl. spaces): force 1 line (nowrap), bigger font
 *  - > 20 chars: allow 2 lines, break at word boundaries, adjusted font
 */
function getNameStyle(name) {
  const len = (name || '').trim().length;
  const words = (name || '').trim().split(/\s+/).length;

  if (len <= 20) {
    // ── Short names: fit on 1 line ──
    let fontSize;
    if (len <= 10) fontSize = '2.2rem';
    else if (len <= 13) fontSize = '1.9rem';
    else if (len <= 16) fontSize = '1.7rem';
    else fontSize = '1.5rem'; // 17-20 chars — must fit ~272px width

    return {
      fontSize,
      singleLine: true, // force 1 line
    };
  }

  // ── Longer names: allow 2 lines with word-wrap — compact font to avoid pushing job title ──
  let fontSize;
  if (len <= 25) fontSize = '1.5rem';
  else if (len <= 32) fontSize = '1.35rem';
  else if (len <= 42) fontSize = '1.2rem';
  else fontSize = '1.1rem';

  return {
    fontSize,
    singleLine: false, // allow 2-line wrap
  };
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

  // Dynamic name style (font size + single/multi-line)
  const nameStyle = getNameStyle(name);
  const nameInlineStyle = nameStyle.singleLine
    ? `font-size:${nameStyle.fontSize};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`
    : `font-size:${nameStyle.fontSize};word-break:normal;overflow-wrap:break-word;`;

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
    '    <div class="idcard-name" style="' + nameInlineStyle + '">' + name + '</div>',
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
