import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import multer from 'multer';
import type { Candidate, Project } from './data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { listResumes, getResume, createResume, updateResume, getFirstResumeId, deleteResume } from './store';
import { extractTextFromPdf } from './pdf';
import { cropResumeFaceToAvatar, cropAvatarFromFaceBox } from './avatarCrop';

const DATA_UPLOADS = path.join(process.cwd(), 'data', 'uploads');
function getUploadedPdfPath(resumeId: string): string {
  return path.join(DATA_UPLOADS, `${resumeId}.pdf`);
}

const app = express();
const PORT = process.env.PORT || 3001;

const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

app.use(express.json());

// CORS：允许前端（Vite 默认 3000）访问
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const apiKey = process.env.DASHSCOPE_API_KEY || '';
const model = process.env.DASHSCOPE_MODEL || '';
const vlModel = process.env.DASHSCOPE_VL_MODEL || 'qwen-vl-max';

// 后台管理页：在浏览器中管理简历（查看 / 删除 / 上传 PDF）
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// 兼容旧接口：无 resumeId 时返回第一份简历
app.get('/api/candidate', (req, res) => {
  const id = req.query.resumeId as string | undefined || getFirstResumeId();
  const resume = id ? getResume(id) : undefined;
  if (!resume) return res.status(404).json({ error: '暂无简历' });
  res.json(resume.candidate);
});

app.get('/api/projects', (req, res) => {
  const id = req.query.resumeId as string | undefined || getFirstResumeId();
  const resume = id ? getResume(id) : undefined;
  if (!resume) return res.status(404).json({ error: '暂无简历' });
  res.json(resume.projects);
});

// 简历列表（用于下拉选择）
app.get('/api/resumes', (_req, res) => {
  res.json(listResumes());
});

// 单份简历详情（候选人 + 项目 + 识别原文/页图）
app.get('/api/resumes/:id', (req, res) => {
  const resume = getResume(req.params.id);
  if (!resume) return res.status(404).json({ error: '简历不存在' });
  res.json({
    candidate: resume.candidate,
    projects: resume.projects,
    ...(resume.rawText !== undefined && { rawText: resume.rawText }),
    ...(resume.pageImages !== undefined && { pageImages: resume.pageImages })
  });
});

// 下载原始上传的 PDF（仅上传过的简历有此文件）
app.get('/api/resumes/:id/download', (req, res) => {
  const resume = getResume(req.params.id);
  if (!resume) return res.status(404).json({ error: '简历不存在' });
  const filePath = getUploadedPdfPath(req.params.id);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '该简历无上传的 PDF' });
  const filename = `${resume.candidate.name}-简历.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  try {
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('下载 PDF 失败:', err);
    if (!res.headersSent) res.status(500).json({ error: '读取 PDF 文件失败' });
  }
});

// 更新当前简历头像（PATCH 或 POST /avatar，body: { avatarUrl: string }）
function updateResumeAvatarHandler(req: express.Request, res: express.Response): void {
  const id = req.params.id;
  const resume = getResume(id);
  if (!resume) return res.status(404).json({ error: '简历不存在' });
  const { avatarUrl } = req.body || {};
  if (typeof avatarUrl !== 'string') return res.status(400).json({ error: '需要 avatarUrl 字符串' });
  const updated = updateResume(id, { ...resume.candidate, avatarUrl }, resume.projects);
  if (!updated) return res.status(404).json({ error: '简历不存在' });
  res.json(updated);
}
app.patch('/api/resumes/:id', updateResumeAvatarHandler);
app.post('/api/resumes/:id/avatar', updateResumeAvatarHandler);

// 删除简历（同时删除已保存的原始 PDF）
app.delete('/api/resumes/:id', (req, res) => {
  const id = req.params.id;
  const ok = deleteResume(id);
  if (!ok) return res.status(404).json({ error: '简历不存在' });
  const filePath = getUploadedPdfPath(id);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
  res.status(204).send();
});

// 新增简历
app.post('/api/resumes', (req, res) => {
  const { candidate, projects } = req.body || {};
  if (!candidate || !Array.isArray(projects)) {
    return res.status(400).json({ error: '需要 candidate 和 projects 数组' });
  }
  const resume = createResume(candidate as Candidate, projects as Project[]);
  res.status(201).json(resume);
});

// 上传 PDF 简历：识别文字 + AI 结构化，存入简历并返回
app.post('/api/resumes/upload', upload.single('file'), async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: '请上传 PDF 文件（字段名 file）' });
  }
  if (!apiKey || !model) {
    return res.status(500).json({ error: '请先配置 .env 中的 DASHSCOPE_API_KEY 和 DASHSCOPE_MODEL' });
  }

  try {
    const { text: rawText } = await extractTextFromPdf(req.file.buffer);
    if (!rawText?.trim()) {
      return res.status(400).json({ error: '无法从 PDF 中识别出文字，请确认是有效 PDF' });
    }

    const prompt = `你是一个简历解析助手。根据以下简历原文，提取为结构化 JSON，只输出一个 JSON 对象，不要 markdown 或其它说明。
要求：
- candidate 包含：name, title(求职意向), highestDegree(最高学历，如硕士/本科/博士), degreeSchool(最高学历毕业学校), location, experienceYears(字符串如"8+"), coreProjects(数字), deliveryRate(字符串如"100%"), skills(字符串数组), capabilities(数组，每项{name,level}，level为0-100数字), avatarUrl(无则用空字符串)
- 其中 name 必须是候选人真实姓名：若简历中有明显的中文姓名（如顶部或左侧大号字体的「霍璐华」等），必须用该中文姓名；禁止把微信号、微信名、英文昵称或邮箱前缀当作 name。
- title 填求职意向（如「用户研究工程师」）；highestDegree 填最高学历；degreeSchool 填该学历对应的学校。
- projects 为数组，每项包含：id(简短英文), title, description, tags(字符串数组), impact(有则填如"35%"，无则留空字符串不要填N/A), imageUrl(一律留空字符串), docUrl(一律填"#")
- 不要输出 impact 为 N/A；不要输出项目配图区块。只输出合法 JSON。`;

    const response = await fetch(DASHSCOPE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: { messages: [{ role: 'user', content: `${prompt}\n\n简历原文：\n${rawText.slice(0, 6000)}` }] },
        parameters: { result_format: 'message' }
      })
    });
    const data = await response.json();
    if (data.code || (data.status_code !== undefined && data.status_code !== 200) || !response.ok) {
      const msg = data.message || data.code || 'AI 解析失败';
      return res.status(500).json({ error: msg });
    }
    const content = data.output?.choices?.[0]?.message?.content ?? '';
    const jsonStr = content.replace(/```json\s*|\s*```/g, '').trim();
    let parsed: { candidate?: Candidate; projects?: Project[] };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.status(500).json({ error: 'AI 返回的结构无法解析，请重试或手动添加简历' });
    }
    const candidate = normalizeCandidate(parsed.candidate);
    const firstPageImage = req.body?.avatarImage;
    if (typeof firstPageImage === 'string' && firstPageImage.startsWith('data:')) {
      let cropped: string | null = null;
      const faceBoxRaw = req.body?.faceBox;
      if (typeof faceBoxRaw === 'string') {
        try {
          const faceBox = JSON.parse(faceBoxRaw) as { x?: number; y?: number; width?: number; height?: number };
          if (
            typeof faceBox.x === 'number' && typeof faceBox.y === 'number' &&
            typeof faceBox.width === 'number' && typeof faceBox.height === 'number' &&
            faceBox.width > 0 && faceBox.height > 0
          ) {
            cropped = await cropAvatarFromFaceBox(firstPageImage, faceBox);
          }
        } catch (_) {}
      }
      if (cropped == null) {
        cropped = await cropResumeFaceToAvatar(firstPageImage, apiKey, vlModel);
      }
      candidate.avatarUrl = cropped ?? '';
    }
    const projects = Array.isArray(parsed.projects) ? parsed.projects.map(normalizeProject) : [];
    const resume = createResume(candidate, projects, { rawText });
    try {
      if (!fs.existsSync(DATA_UPLOADS)) fs.mkdirSync(DATA_UPLOADS, { recursive: true });
      fs.writeFileSync(getUploadedPdfPath(resume.id), req.file!.buffer);
    } catch (e) {
      console.error('保存原始 PDF 失败:', e);
    }
    res.status(201).json({
      id: resume.id,
      candidate: resume.candidate,
      projects: resume.projects,
      rawText: resume.rawText
    });
  } catch (err) {
    console.error('PDF upload error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : '上传解析失败' });
  }
});

function normalizeCandidate(c: unknown): Candidate {
  const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
  return {
    name: String(o.name ?? '未知'),
    title: String(o.title ?? ''),
    highestDegree: o.highestDegree != null ? String(o.highestDegree) : undefined,
    degreeSchool: o.degreeSchool != null ? String(o.degreeSchool) : undefined,
    location: String(o.location ?? ''),
    experienceYears: String(o.experienceYears ?? ''),
    coreProjects: Number(o.coreProjects) || 0,
    deliveryRate: String(o.deliveryRate ?? ''),
    skills: Array.isArray(o.skills) ? o.skills.map(String) : [],
    capabilities: Array.isArray(o.capabilities)
      ? o.capabilities.map((x: unknown) => {
          const t = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
          return { name: String(t.name ?? ''), level: Number(t.level) || 0 };
        })
      : [],
    avatarUrl: String(o.avatarUrl ?? '')
  };
}

function normalizeProject(p: unknown): Project {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  let impact = String(o.impact ?? '').trim();
  if (impact.toUpperCase() === 'N/A') impact = '';
  return {
    id: String(o.id ?? `p-${Date.now()}`),
    title: String(o.title ?? ''),
    description: String(o.description ?? ''),
    tags: Array.isArray(o.tags) ? o.tags.map(String) : [],
    impact,
    imageUrl: String(o.imageUrl ?? ''),
    docUrl: String(o.docUrl ?? '#')
  };
}

// 聊天：按 resumeId 使用对应简历内容
app.post('/api/chat', async (req, res) => {
  const text = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const resumeId = typeof req.body?.resumeId === 'string' ? req.body.resumeId : getFirstResumeId();
  if (!text) {
    return res.status(400).json({ error: 'message 不能为空' });
  }

  const resume = resumeId ? getResume(resumeId) : undefined;
  if (!resume) {
    return res.status(400).json({ content: '请先选择或添加一份简历。' });
  }

  const { candidate, projects, rawText } = resume;
  const isProjectQuery =
    /项目|介绍|经历|做过|参与|负责/.test(text) && !/公司|工作|到岗|时间|技能|能力/.test(text);

  if (isProjectQuery && projects.length > 0) {
    return res.json({
      content: '以下是我的项目经验：',
      projects: projects as Project[]
    });
  }

  if (!apiKey) {
    return res.json({
      content: '未配置 DASHSCOPE_API_KEY，请在服务端 .env 中设置（阿里云百炼 API Key）。'
    });
  }
  if (!model) {
    return res.json({
      content: '未配置 DASHSCOPE_MODEL，请在服务端 .env 中设置模型名称（如 qwen-plus）。'
    });
  }

  try {
    let systemPrompt = `你是${candidate.name}的数字助手。他是${candidate.title}。请根据以下候选人信息，用中文回答用户关于该候选人的问题。\n候选人信息：${JSON.stringify(candidate)}`;
    if (rawText && rawText.trim()) {
      systemPrompt += `\n\n以下是简历原文（含实习经历、项目经历等），回答时请严格依据原文：\n---\n${rawText.slice(0, 8000)}\n---`;
      systemPrompt += `\n\n重要：当用户询问「公司经历」或「实习经历」时，只根据上文简历原文中的「实习经历」部分回答，直接列实习经历内容（公司、时间、职责等），不要添加任何概括性开场白（例如不要写「目前是…」「拥有…经验」「未披露其具体就职公司名称」等），不要推测或补充原文没有的信息。`;
    }
    const response = await fetch(DASHSCOPE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ]
        },
        parameters: { result_format: 'message' }
      })
    });

    const data = await response.json();

    // 接口返回业务错误（HTTP 200 但 body 里 code 非空）
    if (data.code) {
      console.error('DashScope 业务错误:', JSON.stringify(data));
      const msg = data.message || data.code || '通义千问接口返回错误';
      return res.status(500).json({ content: `接口错误：${msg}` });
    }

    // 旧版/部分接口用 status_code
    if (data.status_code !== undefined && data.status_code !== 200) {
      console.error('DashScope status_code 错误:', JSON.stringify(data));
      const msg = data.message || '通义千问接口返回错误';
      return res.status(500).json({ content: `接口错误：${msg}` });
    }

    // HTTP 非 2xx（如 401、429）
    if (!response.ok) {
      console.error('DashScope HTTP 错误:', response.status, JSON.stringify(data));
      const msg = data.message || data.error?.message || `HTTP ${response.status}`;
      return res.status(500).json({ content: `请求失败：${msg}` });
    }

    const content = data.output?.choices?.[0]?.message?.content ?? '抱歉，我暂时无法回答这个问题。';
    res.json({ content });
  } catch (err) {
    console.error('Qwen API Error:', err);
    res.status(500).json({
      content: err instanceof Error ? err.message : '服务暂时出错，请稍后再试。'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`后台管理: http://localhost:${PORT}/admin`);
});
