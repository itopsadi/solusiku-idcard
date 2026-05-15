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
    logo: element.dataset.logo || null
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

    // 8. Logo
    if (logoImg) {
      const logoH = s(40);
      const logoW = (logoImg.width / logoImg.height) * logoH;
      ctx.drawImage(logoImg, s(22), s(12), logoW, logoH);
    }

    // 9. Photo (Antigravity Effect)
    if (empImg) {
      const photoW = s(295);
      const photoH = s(400);
      const photoX = s(10 + 115 - 147.5); // Center relative to circle
      const photoY = s(133 + 230 - 400);

      // Layer 1: Clipped part (Shoulders)
      ctx.save();
      ctx.beginPath();
      ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(empImg, photoX, photoY, photoW, photoH);
      ctx.restore();

      // Layer 2: Pop part (Head)
      ctx.save();
      // Clip only the top part of the head
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, s(133 + 230 * 0.65));
      ctx.clip();
      ctx.drawImage(empImg, photoX, photoY, photoW, photoH);
      ctx.restore();
    }

    // 10. Text (Name, Jabatan, NIK)
    // Name
    ctx.fillStyle = '#111111';
    ctx.font = `800 ${s(24)}px Poppins, sans-serif`;
    ctx.fillText(data.name, s(26), s(133 + 230 + 40));

    // Jabatan
    ctx.fillStyle = '#D94035';
    ctx.font = `600 ${s(18)}px Poppins, sans-serif`;
    ctx.fillText(data.jabatan, s(26), s(133 + 230 + 70));

    // NIK
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
