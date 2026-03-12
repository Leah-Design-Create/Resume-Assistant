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
const DOCURLS_FILE = path.join(DATA_DIR, 'docUrls.json');

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

/** 按候选人姓名+项目标题持久化 docUrl，便于删除简历后重新上传时恢复链接 */
function readDocUrls(): Record<string, Record<string, string>> {
  try {
    if (!fs.existsSync(DOCURLS_FILE)) return {};
    const raw = fs.readFileSync(DOCURLS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeDocUrls(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const docUrls: Record<string, Record<string, string>> = {};
    for (const r of resumes.values()) {
      const name = r.candidate?.name;
      if (!name) continue;
      for (const p of r.projects || []) {
        if (p.docUrl && p.docUrl !== '#') {
          if (!docUrls[name]) docUrls[name] = {};
          docUrls[name][p.title || p.id] = p.docUrl;
        }
      }
    }
    fs.writeFileSync(DOCURLS_FILE, JSON.stringify(docUrls, null, 2), 'utf-8');
  } catch (err) {
    console.error('保存 docUrls 失败:', err);
  }
}

function saveToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const arr = Array.from(resumes.values());
    fs.writeFileSync(RESUMES_FILE, JSON.stringify(arr, null, 2), 'utf-8');
    writeDocUrls();
  } catch (err) {
    console.error('保存简历数据失败:', err);
  }
}

/** 初始化：从文件加载，无数据则写入默认简历；并同步 docUrls 以便删除后重加能恢复链接 */
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
  } else {
    writeDocUrls();
  }
}
init();

export function listResumes(): { id: string; name: string; title: string }[] {
  loadFromFile();
  return Array.from(resumes.values()).map((r) => ({
    id: r.id,
    name: r.candidate.name,
    title: r.candidate.title
  }));
}

export function getResume(id: string): Resume | undefined {
  loadFromFile();
  return resumes.get(id);
}

export function getFirstResumeId(): string | undefined {
  loadFromFile();
  const first = resumes.values().next().value as Resume | undefined;
  return first?.id;
}

export function createResume(
  candidate: Candidate,
  projects: Project[],
  extra?: { rawText?: string; pageImages?: string[] }
): Resume {
  loadFromFile();
  const savedDocUrls = readDocUrls();
  const byName = savedDocUrls[candidate.name];
  const projectsWithUrls = projects.map((p) => {
    const docUrl = byName?.[p.title] || byName?.[p.id] || (p.docUrl && p.docUrl !== '#' ? p.docUrl : '#');
    return { ...p, docUrl, id: p.id || `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
  });
  const id = nextId();
  const resume: Resume = {
    id,
    candidate: { ...candidate },
    projects: projectsWithUrls,
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
