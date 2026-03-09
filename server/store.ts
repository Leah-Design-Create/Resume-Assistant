import fs from 'fs';
import path from 'path';
import type { Candidate, Project } from './data';
import { CANDIDATE_DATA, PROJECTS } from './data';

export interface Resume {
  id: string;
  candidate: Candidate;
  projects: Project[];
  /** PDF 识别出的原文（上传 PDF 时填充） */
  rawText?: string;
  /** PDF 各页转成的图片 data URL（上传 PDF 时填充） */
  pageImages?: string[];
}

const resumes = new Map<string, Resume>();

const DATA_DIR = path.join(process.cwd(), 'data');
const RESUMES_FILE = path.join(DATA_DIR, 'resumes.json');

function nextId(): string {
  return `resume-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadFromFile(): void {
  try {
    const raw = fs.readFileSync(RESUMES_FILE, 'utf-8');
    const arr = JSON.parse(raw) as Resume[];
    if (Array.isArray(arr)) {
      resumes.clear();
      for (const r of arr) {
        if (r?.id && r?.candidate && Array.isArray(r?.projects)) resumes.set(r.id, r);
      }
    }
  } catch {
    // 文件不存在或格式错误，保持当前 Map（可能为空）
  }
}

function saveToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const arr = Array.from(resumes.values());
    fs.writeFileSync(RESUMES_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (err) {
    console.error('保存简历数据失败:', err);
  }
}

/** 初始化：从文件加载，无数据则写入默认简历 */
function init() {
  loadFromFile();
  if (resumes.size === 0) {
    const id = 'resume-default';
    resumes.set(id, {
      id,
      candidate: { ...CANDIDATE_DATA },
      projects: PROJECTS.map((p) => ({ ...p }))
    });
    saveToFile();
  }
}
init();

export function listResumes(): { id: string; name: string; title: string }[] {
  return Array.from(resumes.values()).map((r) => ({
    id: r.id,
    name: r.candidate.name,
    title: r.candidate.title
  }));
}

export function getResume(id: string): Resume | undefined {
  return resumes.get(id);
}

export function getFirstResumeId(): string | undefined {
  const first = resumes.values().next().value as Resume | undefined;
  return first?.id;
}

export function createResume(
  candidate: Candidate,
  projects: Project[],
  extra?: { rawText?: string; pageImages?: string[] }
): Resume {
  const id = nextId();
  const resume: Resume = {
    id,
    candidate: { ...candidate },
    projects: projects.map((p) => ({ ...p, id: p.id || `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
    ...(extra?.rawText !== undefined && { rawText: extra.rawText }),
    ...(extra?.pageImages !== undefined && { pageImages: extra.pageImages })
  };
  resumes.set(id, resume);
  saveToFile();
  return resume;
}

export function updateResume(id: string, candidate: Candidate, projects: Project[]): Resume | undefined {
  const existing = resumes.get(id);
  if (!existing) return undefined;
  const updated: Resume = {
    id,
    candidate: { ...candidate },
    projects: projects.map((p) => ({ ...p, id: p.id || existing.projects[0]?.id || `proj-${Date.now()}` })),
    ...(existing.rawText !== undefined && { rawText: existing.rawText }),
    ...(existing.pageImages !== undefined && { pageImages: existing.pageImages })
  };
  resumes.set(id, updated);
  saveToFile();
  return updated;
}

export function deleteResume(id: string): boolean {
  const ok = resumes.delete(id);
  if (ok) saveToFile();
  return ok;
}
