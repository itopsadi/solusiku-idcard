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
      transform: 'none',
      transformOrigin: 'top left',
      margin: '0',
      padding: '0'
    }
  };

  try {
    // 1. Wait for images and fonts to be ready
    await waitUntilImagesLoaded(element);
    if (document.fonts) await document.fonts.ready;

    // 2. Force a quick layout repaint
    element.style.display = 'none';
    element.offsetHeight; // force reflow
    element.style.display = 'block';

    // 3. Get as Data URL
    const dataURL = await toPng(element, options);
    
    if (!dataURL || dataURL === 'data:,' || dataURL.length < 500) {
      // Retry once after a short delay
      await new Promise(r => setTimeout(r, 200));
      const retryURL = await toPng(element, options);
      if (!retryURL || retryURL.length < 500) {
        throw new Error('Hasil tangkapan gambar kosong. Coba lagi atau pastikan koneksi stabil.');
      }
      return { blob: dataURLToBlob(retryURL), dataURL: retryURL, width: element.clientWidth * scaleFactor, height: element.clientHeight * scaleFactor };
    }

    // 4. Convert Data URL to Blob manually
    const blob = dataURLToBlob(dataURL);
    
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
