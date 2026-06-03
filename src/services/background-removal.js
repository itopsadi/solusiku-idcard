import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';

/**
 * Prepare image blob for background removal.
 * Downscales if needed and returns a PNG blob (no JPEG artifacts).
 */
async function prepareInputBlob(imageDataURL, maxDim) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imageDataURL;
  });

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
    else { width = Math.round(width * maxDim / height); height = maxDim; }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  // Use PNG to avoid JPEG compression artifacts at edges
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Run background removal with GPU→CPU fallback.
 */
async function runRemoval(inputBlob, onProgress, progressStart, progressEnd) {
  const tryRemove = async (device) => {
    return imglyRemoveBackground(inputBlob, {
      progress: (key, current, total) => {
        if (onProgress && total > 0) {
          const range = progressEnd - progressStart;
          onProgress(Math.min(Math.round(progressStart + (current / total) * range), progressEnd));
        }
      },
      output: { format: 'image/png', quality: 1.0 },
      device,
      model: 'medium', // 'medium' model — much better edge accuracy for hair, ears, shoulders
    });
  };

  try {
    return await tryRemove('gpu');
  } catch (gpuErr) {
    console.warn('[BG Removal] GPU failed, trying CPU:', gpuErr.message);
    try {
      return await tryRemove('cpu');
    } catch (cpuErr) {
      console.error('[BG Removal] CPU also failed:', cpuErr.message);
      return null;
    }
  }
}

/**
 * Convert blob to data URL.
 */
function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Remove background from an image using client-side AI.
 * Robust version: GPU → CPU fallback, high-quality model, always resolves.
 */
export async function removeBackground(imageDataURL, onProgress) {
  if (onProgress) onProgress(0);

  const MAX_DIM = 1024; // Higher resolution for better edge detail
  const inputBlob = await prepareInputBlob(imageDataURL, MAX_DIM);
  if (onProgress) onProgress(5);

  const resultBlob = await runRemoval(inputBlob, onProgress, 5, 95);

  if (!resultBlob) {
    // Last resort: return original image (no blank page)
    if (onProgress) onProgress(100);
    return imageDataURL;
  }

  if (onProgress) onProgress(100);
  const dataURL = await blobToDataURL(resultBlob);
  return dataURL || imageDataURL;
}

/**
 * Re-clean background: takes an already-processed image (transparent PNG)
 * and runs remove background again to catch remaining artifacts.
 * This is the "multi-pass" approach for maximum cleanliness.
 */
export async function reCleanBackground(processedDataURL, onProgress) {
  if (onProgress) onProgress(0);

  const MAX_DIM = 1024;
  const inputBlob = await prepareInputBlob(processedDataURL, MAX_DIM);
  if (onProgress) onProgress(5);

  const resultBlob = await runRemoval(inputBlob, onProgress, 5, 95);

  if (!resultBlob) {
    if (onProgress) onProgress(100);
    return processedDataURL;
  }

  if (onProgress) onProgress(100);
  const dataURL = await blobToDataURL(resultBlob);
  return dataURL || processedDataURL;
}
