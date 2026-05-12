let currentStream = null;
let currentFacing = 'user';

export async function initCamera(videoElement, facingMode = 'user') {
  stopCamera();
  currentFacing = facingMode;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
      audio: false,
    });
    currentStream = stream;
    videoElement.srcObject = stream;
    await videoElement.play();
    return true;
  } catch (err) {
    console.error('Camera error:', err);
    return false;
  }
}

export function capturePhoto(videoElement) {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  // Flip horizontally if front camera
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
