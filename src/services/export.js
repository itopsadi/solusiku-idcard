/**
 * ID Card Canvas Rendering Engine (Manual)
 * No third-party libraries, 100% stable on all browsers.
 */

const DPI_SCALE = 3; // For 300 DPI quality
const BASE_W = 324;
const BASE_H = 514;

/**
 * Load an image from URL/Base64
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // Resolve null if image fails
    img.src = src;
  });
}

/**
 * Main export function using Canvas API
 */
export async function exportToImage(element, dpi = 300) {
  // We ignore 'element' and use data from its data attributes or just pass data manually
  // But for compatibility with existing code, we'll try to extract data from the element
  // or better, find a way to pass data to this function.
  
  // Since we want to be 100% stable, we'll look for data in the element's dataset
  // We'll need to update approval.js to set these datasets.
  const data = {
    name: element.dataset.name || 'Nama Karyawan',
    jabatan: element.dataset.jabatan || 'Jabatan',
    nik: element.dataset.nik || 'ADI-0000-000',
    photo: element.dataset.photo || null,
    logo: element.dataset.logo || null,
    panX: parseFloat(element.dataset.panX || 0),
    panY: parseFloat(element.dataset.panY || 0)
  };

  const canvas = document.createElement('canvas');
  canvas.width = BASE_W * DPI_SCALE;
  canvas.height = BASE_H * DPI_SCALE;
  const ctx = canvas.getContext('2d');
  
  const s = (val) => val * DPI_SCALE;

  try {
    // 1. Preload assets
    const [empImg, logoImg] = await Promise.all([
      loadImage(data.photo),
      loadImage(data.logo)
    ]);

    // 2. Draw Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Gray bottom-left deco block
    ctx.fillStyle = '#e2e2e2';
    // width: 96, height: 260
    ctx.fillRect(0, s(BASE_H - 260), s(96), s(260));

    // 4. Gray Circle
    // top: 133, left: 10, size: 230
    const circleX = s(10 + 115);
    const circleY = s(133 + 115);
    const circleR = s(115);
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
    ctx.fillStyle = '#d4d4d4';
    ctx.fill();

    // 5. Red Blob top-right
    ctx.fillStyle = '#D94035';
    // width: 70, height: 160
    const blobW = s(70);
    const blobH = s(160);
    ctx.beginPath();
    ctx.moveTo(canvas.width - blobW, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.lineTo(canvas.width, blobH);
    ctx.quadraticCurveTo(canvas.width - blobW, blobH, canvas.width - blobW, blobH - s(70));
    ctx.closePath();
    ctx.fill();

    // 6. Dots (Top-Right)
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.beginPath();
        ctx.arc(canvas.width - s(12 + 10 + col * 18), s(12 + 5 + row * 18), s(5), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 7. Dots (Bottom-Left)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.beginPath();
        ctx.arc(s(20 + 5 + col * 26), canvas.height - s(22 + 5 + row * 26), s(5), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ============================================================
    // 8. Photo (Antigravity Effect) — UNIFIED COORDINATE SYSTEM
    // All constants match idcard.css exactly
    // ============================================================
    if (empImg) {
      // --- Layout constants from CSS ---
      const WRAPPER_TOP  = 133;  // padding(12) + header(40) + margin-top(81)
      const WRAPPER_LEFT = 10;   // content padding(22) + margin-left(-12)
      const WRAPPER_SIZE = 230;  // matches circle diameter
      const PHOTO_W = 295;       // background-size width
      const PHOTO_H = 400;       // background-size height

      // --- Photo base position (CSS: background-position: bottom center) ---
      // CSS formula: offset = (container - image) * percentage
      // X: (230 - 295) * 0.5 = -32.5 relative to wrapper
      // Y: (230 - 400) * 1.0 = -170  relative to wrapper
      const photoBaseX = WRAPPER_LEFT + (WRAPPER_SIZE - PHOTO_W) / 2;  // = -22.5
      const photoBaseY = WRAPPER_TOP  + (WRAPPER_SIZE - PHOTO_H);      // = -37

      // Apply panning (same pixel offset as CSS calc())
      const photoX = s(photoBaseX + data.panX);
      const photoY = s(photoBaseY + data.panY);
      const photoW = s(PHOTO_W);
      const photoH = s(PHOTO_H);

      // --- Layer 1: Shoulders clipped inside circle ---
      ctx.save();
      ctx.beginPath();
      ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(empImg, photoX, photoY, photoW, photoH);
      ctx.restore();

      // --- Layer 2: Head popping above circle ---
      // CSS: pop element top = WRAPPER_TOP + WRAPPER_SIZE - PHOTO_H = -37
      // CSS clip-path: polygon(0 15%, 100% 15%, 100% 60%, 0 60%)
      //   15% of 400 = 60px from element top → card-y = -37 + 60  = 23
      //   60% of 400 = 240px from element top → card-y = -37 + 240 = 203
      const POP_EL_TOP   = WRAPPER_TOP + WRAPPER_SIZE - PHOTO_H; // -37
      const CLIP_TOP_PCT = 0.15;
      const CLIP_BOT_PCT = 0.60;
      const clipTop = POP_EL_TOP + PHOTO_H * CLIP_TOP_PCT; // 23
      const clipBot = POP_EL_TOP + PHOTO_H * CLIP_BOT_PCT; // 203

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, s(clipTop), canvas.width, s(clipBot - clipTop));
      ctx.clip();
      ctx.drawImage(empImg, photoX, photoY, photoW, photoH);
      ctx.restore();
    }

    // 9. Logo (drawn AFTER photo to match CSS z-index: header=11 < pop=14,
    //    but logo must be visible through transparent photo areas)
    if (logoImg) {
      const logoH = s(40);
      const logoW = (logoImg.width / logoImg.height) * logoH;
      ctx.drawImage(logoImg, s(22), s(12), logoW, logoH);
    }

    // ============================================================
    // 10. Text (Name, Jabatan, NIK) — DYNAMIC SIZING + WORD WRAP
    // Matches idcard.js getNameFontSize/getJobFontSize + CSS line-clamp: 2
    // ============================================================

    // --- Dynamic font size + single-line logic (synced with idcard.js getNameStyle) ---
    function getNameConfig(name) {
      const len = (name || '').trim().length;
      const words = (name || '').trim().split(/\s+/).length;

      if (len <= 20) {
        // Single line — synced with idcard.js
        let fontPx;
        if (len <= 10) fontPx = 35;       // 2.2rem
        else if (len <= 13) fontPx = 30;  // 1.9rem
        else if (len <= 16) fontPx = 27;  // 1.7rem
        else fontPx = 24;                 // 1.5rem
        return { fontPx, singleLine: true };
      }

      // Multi-line (max 2 lines)
      let fontPx;
      if (len <= 25) fontPx = 30;         // 1.85rem
      else if (len <= 32) fontPx = words <= 4 ? 28 : 26; // 1.75/1.6rem
      else if (len <= 42) fontPx = 23;    // 1.45rem
      else fontPx = 20;                   // 1.25rem
      return { fontPx, singleLine: false };
    }

    function getJobFontPx(job) {
      const len = (job || '').length;
      if (len <= 20) return 18;   // 1.15rem ≈ 18px
      if (len <= 35) return 17;   // 1.05rem ≈ 17px
      return 15;                  // 0.95rem ≈ 15px
    }

    // --- Word wrap helper (max N lines, breaks at word boundaries) ---
    function wrapText(ctx, text, maxWidth, maxLines) {
      const words = text.split(/\s+/);
      const lines = [];
      let currentLine = words[0] || '';

      for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        if (ctx.measureText(testLine).width <= maxWidth) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = words[i];
          if (lines.length >= maxLines) break;
        }
      }
      if (lines.length < maxLines) {
        lines.push(currentLine);
      }
      return lines.slice(0, maxLines);
    }

    // --- Layout constants ---
    const TEXT_LEFT   = 26;           // content padding(22) + info padding(4)
    const TEXT_MAX_W  = 324 - 26 - 22; // card width minus left and right padding = 276px
    const INFO_TOP    = 133 + 230 + 16; // wrapper bottom + margin-top(16)

    // Name
    const nameConfig = getNameConfig(data.name);
    const nameFontPx = nameConfig.fontPx;
    const nameLH     = nameFontPx * 1.1; // CSS line-height: 1.1
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'left';
    ctx.font = `800 ${s(nameFontPx)}px Poppins, sans-serif`;

    let nameY = s(INFO_TOP) + s(nameFontPx); // baseline of first line
    if (nameConfig.singleLine) {
      // ≤ 20 chars: draw on single line, no wrapping
      ctx.fillText(data.name, s(TEXT_LEFT), nameY);
      nameY += s(nameLH);
    } else {
      // > 20 chars: word-wrap to max 2 lines
      const nameLines = wrapText(ctx, data.name, s(TEXT_MAX_W), 2);
      for (const line of nameLines) {
        ctx.fillText(line, s(TEXT_LEFT), nameY);
        nameY += s(nameLH);
      }
    }

    // Jabatan (starts after name + 3px margin-bottom)
    const jabatanFontPx = getJobFontPx(data.jabatan);
    const jabatanLH     = jabatanFontPx * 1.2; // CSS line-height: 1.2
    const jabatanStartY = nameY + s(3); // CSS margin-bottom: 3px on name
    ctx.fillStyle = '#D94035';
    ctx.font = `600 ${s(jabatanFontPx)}px Poppins, sans-serif`;
    const jabatanLines = wrapText(ctx, data.jabatan, s(TEXT_MAX_W), 2);
    let jabatanY = jabatanStartY;
    for (const line of jabatanLines) {
      ctx.fillText(line, s(TEXT_LEFT), jabatanY);
      jabatanY += s(jabatanLH);
    }

    // NIK (always bottom-right)
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'right';
    ctx.font = `700 ${s(16)}px Poppins, sans-serif`;
    ctx.fillText(data.nik, canvas.width - s(22), canvas.height - s(18));

    // 11. Export
    const dataURL = canvas.toDataURL('image/png');
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve({ blob, dataURL, width: canvas.width, height: canvas.height });
      }, 'image/png');
    });

  } catch (err) {
    console.error('Canvas Export Error:', err);
    throw err;
  }
}

export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
