import { toPng, toBlob } from 'html-to-image';

/**
 * Export a DOM element as high-resolution PNG
 * @param {HTMLElement} element - The element to export
 * @param {number} dpi - Target DPI (default 300)
 * @returns {Promise<{blob: Blob, dataURL: string}>}
 */
export async function exportToImage(element, dpi = 300) {
  const scaleFactor = dpi / 96; // Browser default is 96 DPI
  
  const options = {
    pixelRatio: scaleFactor,
    cacheBust: true,
    style: {
      transform: 'scale(1)',
      transformOrigin: 'top left'
    }
  };

  const dataURL = await toPng(element, options);
  const blob = await toBlob(element, options);

  // Note: html-to-image doesn't return canvas dimensions directly,
  // but we know it scales the element's client dimensions
  const width = element.clientWidth * scaleFactor;
  const height = element.clientHeight * scaleFactor;

  return { blob, dataURL, width, height };
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
