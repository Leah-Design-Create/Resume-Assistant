import fs from 'fs';
import path from 'path';
import type { Candidate, Project } from './data';
import { CANDIDATE_DATA, PROJECTS } from './data';

export interface Resume {
  id: string;
  candidate: Candidate;
  projects: Project[];
  rawText?: string;
  pageImages?: string[];
}

const resumes = new Map<string, Resume>();
const DATA_DIR = path.join(process.cwd(), 'data');
const RESUMES_FILE = path.join(DATA_DIR, 'resumes.json');
const DOCURLS_FILE = path.join(DATA_DIR, 'docUrls.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

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
    // ignore
  }
}

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

function init(): void {
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

export async function listResumes(): Promise<{ id: string; name: string; title: string }[]> {
  loadFromFile();
  return Array.from(resumes.values()).map((r) => ({
    id: r.id,
    name: r.candidate.name,
    title: r.candidate.title
  }));
}

export async function getResume(id: string): Promise<Resume | undefined> {
  loadFromFile();
  return resumes.get(id);
}

export async function getFirstResumeId(): Promise<string | undefined> {
  loadFromFile();
  const first = resumes.values().next().value as Resume | undefined;
  return first?.id;
}

export async function createResume(
  candidate: Candidate,
  projects: Project[],
  extra?: { rawText?: string; pageImages?: string[] }
): Promise<Resume> {
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

export async function updateResume(
  id: string,
  candidate: Candidate,
  projects: Project[]
): Promise<Resume | undefined> {
  loadFromFile();
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

export async function deleteResume(id: string): Promise<boolean> {
  loadFromFile();
  const ok = resumes.delete(id);
  if (ok) saveToFile();
  return ok;
}

function getPdfPath(resumeId: string): string {
  return path.join(UPLOADS_DIR, `${resumeId}.pdf`);
}

export async function saveResumePdf(resumeId: string, buffer: Buffer): Promise<void> {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(getPdfPath(resumeId), buffer);
  } catch (e) {
    console.error('保存 PDF 失败:', e);
  }
}

export async function getResumePdf(resumeId: string): Promise<Buffer | null> {
  try {
    const p = getPdfPath(resumeId);
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

export async function deleteResumePdf(resumeId: string): Promise<void> {
  try {
    const p = getPdfPath(resumeId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {}
}
