import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';

/**
 * Remove background from an image using client-side AI.
 * Robust version: GPU → CPU fallback, reduced memory, always resolves.
 */
export async function removeBackground(imageDataURL, onProgress) {
  if (onProgress) onProgress(0);

  // 1. Downscale to reduce memory pressure (especially on mobile)
  const MAX_DIM = 800; // Increased from 600 to 800 to improve blurriness while keeping memory safe
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imageDataURL;
  });

  let { width, height } = img;
  if (width > MAX_DIM || height > MAX_DIM) {
    if (width > height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
    else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const inputBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
  if (onProgress) onProgress(10);

  // 2. Try GPU first, fallback to CPU if it crashes
  const tryRemove = async (device) => {
    return imglyRemoveBackground(inputBlob, {
      progress: (key, current, total) => {
        if (onProgress && total > 0) {
          onProgress(Math.min(Math.round(10 + (current / total) * 85), 95));
        }
      },
      output: { format: 'image/png', quality: 0.95 },
      device,
      model: 'small', // Use 'small' model — much lighter, still good quality
    });
  };

  let resultBlob;
  try {
    resultBlob = await tryRemove('gpu');
  } catch (gpuErr) {
    console.warn('[BG Removal] GPU failed, trying CPU:', gpuErr.message);
    try {
      resultBlob = await tryRemove('cpu');
    } catch (cpuErr) {
      console.error('[BG Removal] CPU also failed:', cpuErr.message);
      // Last resort: return original image (no blank page)
      if (onProgress) onProgress(100);
      return imageDataURL;
    }
  }

  if (onProgress) onProgress(100);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(imageDataURL); // fallback on read error
    reader.readAsDataURL(resultBlob);
  });
}
