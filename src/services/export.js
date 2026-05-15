import { toPng, toBlob } from 'html-to-image';

/**
 * Export a DOM element as high-resolution PNG
 * @param {HTMLElement} element - The element to export
 * @param {number} dpi - Target DPI (default 300)
 * @returns {Promise<{blob: Blob, dataURL: string, width: number, height: number}>}
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
    // 1. Get as Data URL (more stable than toBlob)
    const dataURL = await toPng(element, options);
    
    // 2. Convert Data URL to Blob manually
    const response = await fetch(dataURL);
    const blob = await response.blob();

    const width = element.clientWidth * scaleFactor;
    const height = element.clientHeight * scaleFactor;

    return { blob, dataURL, width, height };
  } catch (err) {
    console.error('Export service error:', err);
    throw new Error('Gagal menangkap gambar template: ' + err.message);
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
