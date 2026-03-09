import type { Candidate, Project } from './types';

/** 生产环境填后端地址（如 Render），开发环境用 /api 走 Vite 代理 */
const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api';

export interface ChatResponse {
  content: string;
  project?: Project;
}

export interface ResumeItem {
  id: string;
  name: string;
  title: string;
}

export interface ResumeDetail {
  candidate: Candidate;
  projects: Project[];
  rawText?: string;
  pageImages?: string[];
}

/** 简历列表 */
export async function fetchResumes(): Promise<ResumeItem[]> {
  const res = await fetch(`${API_BASE}/resumes`);
  if (!res.ok) throw new Error('获取简历列表失败');
  return res.json();
}

/** 单份简历详情（候选人 + 项目） */
export async function fetchResumeDetail(id: string): Promise<ResumeDetail> {
  const res = await fetch(`${API_BASE}/resumes/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('获取简历详情失败');
  return res.json();
}

/** 新增简历 */
export async function createResume(candidate: Candidate, projects: Project[]): Promise<{ id: string; candidate: Candidate; projects: Project[] }> {
  const res = await fetch(`${API_BASE}/resumes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate, projects }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `创建失败: ${res.status}`);
  }
  return res.json();
}

/** 下载当前简历为 PDF（仅支持通过「上传 PDF 简历」导入的简历） */
export async function downloadResumePdf(id: string, filename?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/resumes/${encodeURIComponent(id)}/download`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '下载失败');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? '简历.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

/** 更新当前简历头像（avatarUrl 为 base64 data URL），使用 POST 避免代理对 PATCH 的兼容问题 */
export async function updateResumeAvatar(id: string, avatarUrl: string): Promise<ResumeDetail> {
  const res = await fetch(`${API_BASE}/resumes/${encodeURIComponent(id)}/avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `更新失败: ${res.status}`);
  }
  return res.json();
}

/** 删除简历 */
export async function deleteResume(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/resumes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `删除失败: ${res.status}`);
  }
}

/** 上传 PDF 简历：识别内容并生成结构化简历；avatarImage 为第一页图；faceBox 为前端人脸检测框 0~1（可选） */
export async function uploadResumePdf(
  file: File,
  avatarImage?: string | null,
  faceBox?: { x: number; y: number; width: number; height: number } | null
): Promise<{ id: string; candidate: Candidate; projects: Project[]; rawText?: string }> {
  const form = new FormData();
  form.append('file', file);
  if (avatarImage) form.append('avatarImage', avatarImage);
  if (faceBox) form.append('faceBox', JSON.stringify(faceBox));
  const res = await fetch(`${API_BASE}/resumes/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `上传失败: ${res.status}`);
  }
  return res.json();
}

/** 发送聊天消息（按当前简历回答） */
export async function sendChatMessage(message: string, resumeId: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message.trim(), resumeId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.content || err.error || `请求失败: ${res.status}`);
  }
  return res.json();
}
