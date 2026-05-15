import { toPng, toBlob } from 'html-to-image';

/**
 * Robust conversion of DataURL to Blob
 */
function dataURLToBlob(dataurl) {
  try {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error('Manual Blob conversion failed:', e);
    return null;
  }
}

/**
 * Ensure all images in an element are loaded
 */
async function waitUntilImagesLoaded(element) {
  const imgs = Array.from(element.querySelectorAll('img'));
  const promises = imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve; // Continue even if image fails
    });
  });
  return Promise.all(promises);
}

/**
 * Export a DOM element as high-resolution PNG
 */
export async function exportToImage(element, dpi = 300) {
  const scaleFactor = dpi / 96;
  
  const options = {
    pixelRatio: scaleFactor,
    cacheBust: true,
    style: {
      transform: 'scale(1)',
      transformOrigin: 'top left'
    }
  };

  try {
    // 1. Wait for images to be ready
    await waitUntilImagesLoaded(element);

    // 2. Get as Data URL
    const dataURL = await toPng(element, options);
    
    if (!dataURL || dataURL === 'data:,' || dataURL.length < 100) {
      throw new Error('Hasil tangkapan gambar kosong. Pastikan template terlihat jelas di layar.');
    }

    // 3. Convert Data URL to Blob manually
    const blob = dataURLToBlob(dataURL);
    
    if (!blob || blob.size === 0) {
      throw new Error('Gagal mengonversi gambar ke file (0 byte).');
    }

    const width = element.clientWidth * scaleFactor;
    const height = element.clientHeight * scaleFactor;

    return { blob, dataURL, width, height };
  } catch (err) {
    console.error('Export service error:', err);
    throw err;
  }
}

/**
 * Download a blob as file
 */
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
