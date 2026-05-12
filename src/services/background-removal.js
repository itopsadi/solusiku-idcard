import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';

/**
 * Remove background from an image using client-side AI (ONNX/WebAssembly).
 * First run downloads the model (~40MB), subsequent runs use cached version.
 * 
 * @param {string} imageDataURL - Base64 data URL of the image
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<string>} - PNG data URL with transparent background
 */
export async function removeBackground(imageDataURL, onProgress) {
  if (onProgress) onProgress(0);

  // Convert data URL to Blob for the library
  const response = await fetch(imageDataURL);
  const inputBlob = await response.blob();

  if (onProgress) onProgress(5);

  try {
    const resultBlob = await imglyRemoveBackground(inputBlob, {
      progress: (key, current, total) => {
        if (onProgress && total > 0) {
          // Map library progress to 5-95 range
          const pct = Math.round(5 + (current / total) * 90);
          onProgress(Math.min(pct, 95));
        }
      },
      output: {
        format: 'image/png',
        quality: 1.0,
      },
    });

    if (onProgress) onProgress(100);

    // Convert result Blob to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(resultBlob);
    });
  } catch (err) {
    console.error('Background removal failed:', err);
    throw new Error('Gagal menghapus background: ' + err.message);
  }
}
