import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';

/**
 * Remove background from an image using client-side AI.
 * Optimization: We downscale the image for faster processing on mobile devices
 * and to prevent main-thread blocking (browser "Wait" prompts).
 */
export async function removeBackground(imageDataURL, onProgress) {
  if (onProgress) onProgress(0);

  // 1. Load and downscale the image first to speed up AI processing
  // Most AI models for background removal work perfectly at lower resolutions (~480-512px)
  const img = new Image();
  await new Promise(resolve => {
    img.onload = resolve;
    img.src = imageDataURL;
  });

  const maxDim = 512; // Sufficient for clean mask analysis
  let width = img.width;
  let height = img.height;

  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height *= maxDim / width;
      width = maxDim;
    } else {
      width *= maxDim / height;
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const inputBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  
  if (onProgress) onProgress(10);

  try {
    // 2. Process with hardware acceleration hints
    const resultBlob = await imglyRemoveBackground(inputBlob, {
      progress: (key, current, total) => {
        if (onProgress && total > 0) {
          const pct = Math.round(10 + (current / total) * 85);
          onProgress(Math.min(pct, 95));
        }
      },
      output: {
        format: 'image/png',
        quality: 0.8, // Slightly lower quality for much faster encoding
      },
      // Suggesting GPU usage to avoid CPU bottlenecking
      device: 'gpu', 
      model: 'medium' // Using medium instead of large if library supports it
    });

    if (onProgress) onProgress(100);

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
