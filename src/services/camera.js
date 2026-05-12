let currentStream = null;
let currentFacing = 'environment'; // Default kamera belakang untuk foto ID Card

export async function initCamera(videoElement, facingMode = 'environment') {
  stopCamera();
  currentFacing = facingMode;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        // Portrait 9:16 constraints
        width: { ideal: 720 },
        height: { ideal: 1280 },
        aspectRatio: { ideal: 9/16 }
      },
      audio: false,
    });
    currentStream = stream;
    videoElement.srcObject = stream;
    await videoElement.play();
    return true;
  } catch (err) {
    // Fallback: try without strict facingMode constraint
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      currentStream = stream;
      videoElement.srcObject = stream;
      await videoElement.play();
      return true;
    } catch (err2) {
      console.error('Camera error:', err2);
      return false;
    }
  }
}

export function capturePhoto(videoElement) {
  const canvas = document.createElement('canvas');
  // Capture at native resolution
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  // Only mirror front camera
  if (currentFacing === 'user') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(videoElement, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.95);
}

export async function switchCamera(videoElement) {
  const newFacing = currentFacing === 'user' ? 'environment' : 'user';
  return initCamera(videoElement, newFacing);
}

export function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
}

export function isCameraSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export function getCurrentFacing() {
  return currentFacing;
}
