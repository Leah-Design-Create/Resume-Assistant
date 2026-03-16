import type { Candidate, Project } from './data';
import { getPool, initDb } from './db';

export interface Resume {
  id: string;
  candidate: Candidate;
  projects: Project[];
  rawText?: string;
  pageImages?: string[];
}

function nextId(): string {
  return `resume-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 从数据库中已存在的简历里，按候选人姓名提取各项目的 docUrl，用于新建时合并 */
async function getDocUrlsByCandidateName(candidateName: string): Promise<Record<string, string>> {
  const pool = getPool();
  if (!pool) return {};
  const r = await pool.query(
    'SELECT projects FROM resumes WHERE candidate->>\'name\' = $1',
    [candidateName]
  );
  const out: Record<string, string> = {};
  for (const row of r.rows) {
    const projects = row.projects as Project[];
    if (!Array.isArray(projects)) continue;
    for (const p of projects) {
      if (p.docUrl && p.docUrl !== '#') out[p.title || p.id] = p.docUrl;
    }
  }
  return out;
}

let inited = false;

async function ensureInit(): Promise<void> {
  if (inited) return;
  await initDb();
  inited = true;
}

export async function listResumes(): Promise<{ id: string; name: string; title: string }[]> {
  const pool = getPool();
  if (!pool) return [];
  await ensureInit();
  const r = await pool.query('SELECT id, candidate FROM resumes ORDER BY created_at ASC');
  return r.rows.map((row: { id: string; candidate: Candidate }) => ({
    id: row.id,
    name: row.candidate?.name ?? '',
    title: row.candidate?.title ?? ''
  }));
}

export async function getResume(id: string): Promise<Resume | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureInit();
  const r = await pool.query(
    'SELECT id, candidate, projects, raw_text FROM resumes WHERE id = $1',
    [id]
  );
  const row = r.rows[0];
  if (!row) return undefined;
  return {
    id: row.id,
    candidate: row.candidate,
    projects: row.projects ?? [],
    ...(row.raw_text != null && { rawText: row.raw_text })
  };
}

export async function getFirstResumeId(): Promise<string | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureInit();
  const r = await pool.query('SELECT id FROM resumes ORDER BY created_at ASC LIMIT 1');
  return r.rows[0]?.id;
}

export async function createResume(
  candidate: Candidate,
  projects: Project[],
  extra?: { rawText?: string; pageImages?: string[] }
): Promise<Resume> {
  const pool = getPool();
  if (!pool) throw new Error('数据库未配置');
  await ensureInit();
  const byName = await getDocUrlsByCandidateName(candidate.name);
  const projectsWithUrls = projects.map((p) => {
    const docUrl = byName[p.title] || byName[p.id] || (p.docUrl && p.docUrl !== '#' ? p.docUrl : '#');
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
  await pool.query(
    'INSERT INTO resumes (id, candidate, projects, raw_text) VALUES ($1, $2, $3, $4)',
    [id, JSON.stringify(resume.candidate), JSON.stringify(resume.projects), resume.rawText ?? null]
  );
  return resume;
}

export async function updateResume(
  id: string,
  candidate: Candidate,
  projects: Project[]
): Promise<Resume | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureInit();
  const existing = await getResume(id);
  if (!existing) return undefined;
  const updated: Resume = {
    id,
    candidate: { ...candidate },
    projects: projects.map((p) => ({
      ...p,
      id: p.id || existing.projects[0]?.id || `proj-${Date.now()}`
    })),
    ...(existing.rawText !== undefined && { rawText: existing.rawText }),
    ...(existing.pageImages !== undefined && { pageImages: existing.pageImages })
  };
  await pool.query(
    'UPDATE resumes SET candidate = $1, projects = $2 WHERE id = $3',
    [JSON.stringify(updated.candidate), JSON.stringify(updated.projects), id]
  );
  return updated;
}

export async function deleteResume(id: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  await ensureInit();
  const r = await pool.query('DELETE FROM resumes WHERE id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function saveResumePdf(resumeId: string, buffer: Buffer): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await ensureInit();
  await pool.query(
    'INSERT INTO resume_pdfs (resume_id, content) VALUES ($1, $2) ON CONFLICT (resume_id) DO UPDATE SET content = $2',
    [resumeId, buffer]
  );
}

export async function getResumePdf(resumeId: string): Promise<Buffer | null> {
  const pool = getPool();
  if (!pool) return null;
  await ensureInit();
  const r = await pool.query('SELECT content FROM resume_pdfs WHERE resume_id = $1', [resumeId]);
  const row = r.rows[0];
  return row?.content ?? null;
}
