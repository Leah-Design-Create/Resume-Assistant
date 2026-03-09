/**
 * 从 PDF 文件渲染第一页为图片。提供两种尺寸：
 * - 高分辨率图：供后端 VL 识别人脸/证件照（需足够大才能识别）
 * - 头像尺寸图：用于展示等（200x200）
 */
import * as pdfjsLib from 'pdfjs-dist';

const AVATAR_SIZE = 200;
/** 发给后端识别人脸用的第一页图：长边不超过此像素，保证人脸不被缩得太小 */
const DETECTION_MAX_SIZE = 1000;

let workerInited = false;
function initWorker() {
  if (workerInited) return;
  try {
    const gwo = (pdfjsLib as unknown as { GlobalWorkerOptions?: { workerSrc: string } }).GlobalWorkerOptions;
    if (gwo) {
      gwo.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as { version?: string }).version || '4.0.379'}/pdf.worker.min.mjs`;
    }
  } catch {}
  workerInited = true;
}

async function renderFirstPageToCanvas(
  file: File,
  maxWidth: number,
  maxHeight: number
): Promise<{ canvas: HTMLCanvasElement; viewport: { width: number; height: number } } | null> {
  initWorker();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height, 2.5);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const task = page.render({
    canvasContext: ctx,
    viewport,
    intent: 'display'
  } as Parameters<typeof page.render>[0]);
  await (task as { promise: Promise<void> }).promise;
  return { canvas, viewport };
}

/**
 * 第一页渲染为较大尺寸的 data URL，供后端 VL 识别人脸/证件照用。
 * 长边不超过 DETECTION_MAX_SIZE，保证人脸在图中有足够像素便于识别。
 */
export async function getPdfFirstPageAsImageUrlForDetection(file: File): Promise<string | null> {
  try {
    const result = await renderFirstPageToCanvas(file, DETECTION_MAX_SIZE, DETECTION_MAX_SIZE);
    if (!result) return null;
    return result.canvas.toDataURL('image/jpeg', 0.88);
  } catch {
    return null;
  }
}

/**
 * 第一页渲染为 200x200 头像尺寸的 data URL（整页等比缩放到 200x200 内）。
 */
export async function getPdfFirstPageAsImageUrl(file: File): Promise<string | null> {
  try {
    const result = await renderFirstPageToCanvas(file, AVATAR_SIZE, AVATAR_SIZE);
    if (!result) return null;
    const { canvas: srcCanvas, viewport } = result;
    const out = document.createElement('canvas');
    out.width = AVATAR_SIZE;
    out.height = AVATAR_SIZE;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    const scaleW = AVATAR_SIZE / viewport.width;
    const scaleH = AVATAR_SIZE / viewport.height;
    const drawScale = Math.max(scaleW, scaleH);
    const drawW = viewport.width * drawScale;
    const drawH = viewport.height * drawScale;
    const dx = (AVATAR_SIZE - drawW) / 2;
    const dy = (AVATAR_SIZE - drawH) / 2;
    ctx.drawImage(srcCanvas, 0, 0, viewport.width, viewport.height, dx, dy, drawW, drawH);
    return out.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}
