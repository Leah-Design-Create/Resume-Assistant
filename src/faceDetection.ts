/**
 * 前端人脸检测：用 face-api.js 检测人脸，优先用 68 关键点算紧框，避免裁进文字。
 */
import * as faceapi from 'face-api.js';

const MODEL_URL =
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/';
let modelsLoaded = false;

export async function ensureFaceModelsLoaded(): Promise<boolean> {
  if (modelsLoaded) return true;
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    return true;
  } catch (e) {
    console.warn('[人脸检测] 模型加载失败，将回退到服务端识别:', e);
    return false;
  }
}

/** 从 68 关键点算紧框（只包住脸），加少量边距后转为 0~1 */
function boxFromLandmarks(
  landmarks: faceapi.FaceLandmarks68,
  imgW: number,
  imgH: number,
  padding: number
): { x: number; y: number; width: number; height: number } {
  const positions = landmarks.positions;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = padding * Math.max(maxX - minX, maxY - minY);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(imgW, maxX + pad);
  maxY = Math.min(imgH, maxY + pad);
  return {
    x: minX / imgW,
    y: minY / imgH,
    width: (maxX - minX) / imgW,
    height: (maxY - minY) / imgH,
  };
}

/** 在图片 data URL 上检测人脸，返回紧框（0~1）。优先用关键点紧框，失败则用检测框并大幅缩小。 */
export async function detectFaceBoxInImage(imageDataUrl: string): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
} | null> {
  const ok = await ensureFaceModelsLoaded();
  if (!ok) return null;
  return new Promise((resolve) => {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const opts = new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.5,
        });
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(null);
          return;
        }
        const withLandmarks = await faceapi
          .detectAllFaces(img, opts)
          .withFaceLandmarks(true);
        if (withLandmarks.length > 0 && withLandmarks[0].landmarks) {
          const box = boxFromLandmarks(withLandmarks[0].landmarks, w, h, 0.12);
          resolve(box);
          return;
        }
        const detections = await faceapi.detectAllFaces(img, opts);
        if (!detections.length) {
          resolve(null);
          return;
        }
        const box = detections[0].box;
        let nx = box.x / w;
        let ny = box.y / h;
        let nw = box.width / w;
        let nh = box.height / h;
        const shrink = 0.38;
        const nw2 = nw * shrink;
        const nh2 = nh * shrink;
        nx = nx + (nw - nw2) / 2;
        ny = ny + (nh - nh2) / 2;
        nx = Math.max(0, Math.min(1 - nw2, nx));
        ny = Math.max(0, Math.min(1 - nh2, ny));
        resolve({ x: nx, y: ny, width: nw2, height: nh2 });
      } catch (e) {
        console.warn('[人脸检测] 检测异常:', e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageDataUrl;
  });
}
