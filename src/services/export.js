import html2canvas from 'html2canvas';

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
      img.onerror = resolve;
    });
  });
  return Promise.all(promises);
}

/**
 * Export a DOM element as high-resolution PNG using html2canvas
 */
export async function exportToImage(element, dpi = 300) {
  const scale = dpi / 96;
  
  try {
    // 1. Wait for readiness
    await waitUntilImagesLoaded(element);
    if (document.fonts) await document.fonts.ready;

    // 2. Capture using html2canvas (more robust for mobile)
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
      onclone: (clonedDoc) => {
        // Ensure the element in the clone is visible and has no transforms
        const clonedElement = clonedDoc.querySelector('.idcard');
        if (clonedElement) {
          clonedElement.style.transform = 'none';
          clonedElement.style.margin = '0';
          clonedElement.style.position = 'relative';
          clonedElement.style.display = 'block';
        }
      }
    });

    // 3. Get Data URL from canvas
    const dataURL = canvas.toDataURL('image/png');
    
    if (!dataURL || dataURL.length < 500) {
      throw new Error('Canvas render failed to produce valid data.');
    }

    // 4. Convert to Blob
    const blob = dataURLToBlob(dataURL);

    return { 
      blob, 
      dataURL, 
      width: canvas.width, 
      height: canvas.height 
    };
  } catch (err) {
    console.error('html2canvas Export Error:', err);
    throw new Error('Gagal merender ID Card: ' + err.message);
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
