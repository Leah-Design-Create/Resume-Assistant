/**
 * 头像裁剪：优先用前端传来的人脸框 (faceBox) 裁剪；无则用 VL 识别人脸中心再裁。
 */
import sharp from 'sharp';

const DASHSCOPE_VL_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

const VL_PROMPT = `这是简历第一页的截图。请找出图中证件照或人脸的大致中心点。
只回复一个 JSON，不要 markdown、不要其他文字。格式：{"x":数字,"y":数字}
x、y 为该中心点相对整图的比例，取值 0~1（0.5 表示正中间）。没有人脸或证件照则回复：{"x":null}`;

/** 以 (nx, ny) 为比例的中心点，裁出边长占图短边比例 sideRatio 的正方形，限制在图内 */
async function cropSquareFromCenter(
  buffer: Buffer,
  nx: number,
  ny: number,
  sideRatio: number
): Promise<{ left: number; top: number; side: number } | null> {
  try {
    const m = await sharp(buffer).metadata();
    const imgW = m.width ?? 0;
    const imgH = m.height ?? 0;
    if (imgW < 10 || imgH < 10) return null;
    const side = Math.min(imgW, imgH, Math.max(80, Math.floor(Math.min(imgW, imgH) * sideRatio)));
    const cx = nx * imgW;
    const cy = ny * imgH;
    let left = Math.floor(cx - side / 2);
    let top = Math.floor(cy - side / 2);
    left = Math.max(0, Math.min(left, imgW - side));
    top = Math.max(0, Math.min(top, imgH - side));
    return { left, top, side };
  } catch {
    return null;
  }
}

export async function cropResumeFaceToAvatar(
  firstPageDataUrl: string,
  apiKey: string,
  vlModel: string
): Promise<string | null> {
  try {
    const response = await fetch(DASHSCOPE_VL_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: vlModel,
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { image: firstPageDataUrl },
                { text: VL_PROMPT }
              ]
            }
          ]
        },
        parameters: { result_format: 'message' }
      })
    });
    const data = await response.json();
    if (data.code || (data.status_code !== undefined && data.status_code !== 200) || !response.ok) {
      console.warn('[头像识别] VL 接口异常:', data.code ?? data.status_code, data.message ?? data);
      return null;
    }
    const raw = data.output?.choices?.[0]?.message?.content;
    let content = '';
    if (typeof raw === 'string') content = raw;
    else if (Array.isArray(raw)) content = raw.map((p: { text?: string }) => p?.text).filter(Boolean).join('');
    if (!content) {
      console.warn('[头像识别] VL 返回内容为空');
      return null;
    }

    const jsonStr = String(content).replace(/```json\s*|\s*```/g, '').trim();
    let parsed: { x?: number | null; y?: number };
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.warn('[头像识别] VL 返回非 JSON:', content.slice(0, 200));
      return null;
    }
    if (parsed.x == null || typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      console.warn('[头像识别] 未检测到人脸/证件照，VL 返回:', jsonStr.slice(0, 120));
      return null;
    }
    let nx = Number(parsed.x);
    let ny = Number(parsed.y);
    if (Number.isNaN(nx) || Number.isNaN(ny)) return null;
    if (nx > 1 || nx < 0) nx = Math.max(0, Math.min(1, nx));
    if (ny > 1 || ny < 0) ny = Math.max(0, Math.min(1, ny));

    const base64Match = firstPageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!base64Match) return null;
    const buffer = Buffer.from(base64Match[1], 'base64');
    const crop = await cropSquareFromCenter(buffer, nx, ny, 0.2);
    if (!crop) return null;

    const out = await sharp(buffer)
      .extract({ left: crop.left, top: crop.top, width: crop.side, height: crop.side })
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 88 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch (e) {
    console.warn('[头像识别] 异常:', e);
    return null;
  }
}

/** 用前端人脸检测得到的框 (0~1) 直接裁正方形头像，不调 VL */
export async function cropAvatarFromFaceBox(
  firstPageDataUrl: string,
  faceBox: { x: number; y: number; width: number; height: number }
): Promise<string | null> {
  try {
    const base64Match = firstPageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!base64Match) return null;
    const buffer = Buffer.from(base64Match[1], 'base64');
    const m = await sharp(buffer).metadata();
    const imgW = m.width ?? 0;
    const imgH = m.height ?? 0;
    if (imgW < 10 || imgH < 10) return null;
    const left = Math.max(0, Math.min(Math.floor(faceBox.x * imgW), imgW - 1));
    const top = Math.max(0, Math.min(Math.floor(faceBox.y * imgH), imgH - 1));
    const w = Math.max(20, Math.min(imgW - left, Math.floor(faceBox.width * imgW)));
    const h = Math.max(20, Math.min(imgH - top, Math.floor(faceBox.height * imgH)));
    const cx = left + w / 2;
    const cy = top + h / 2;
    const side = Math.min(imgW, imgH, Math.max(48, Math.ceil(Math.max(w, h) * 0.92)));
    let cropLeft = Math.floor(cx - side / 2);
    let cropTop = Math.floor(cy - side / 2);
    cropLeft = Math.max(0, Math.min(cropLeft, imgW - side));
    cropTop = Math.max(0, Math.min(cropTop, imgH - side));
    const out = await sharp(buffer)
      .extract({
        left: cropLeft,
        top: cropTop,
        width: Math.min(side, imgW - cropLeft),
        height: Math.min(side, imgH - cropTop),
      })
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 88 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch (e) {
    console.warn('[头像裁剪] 按框裁剪异常:', e);
    return null;
  }
}
