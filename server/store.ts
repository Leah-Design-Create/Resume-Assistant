import type { Candidate, Project } from './data';
import * as storeFile from './store-file';
import * as storeDb from './store-db';

export type { Resume } from './store-file';

const useDb = Boolean(process.env.DATABASE_URL);

export async function listResumes(): Promise<{ id: string; name: string; title: string }[]> {
  return useDb ? storeDb.listResumes() : storeFile.listResumes();
}

export async function getResume(id: string): Promise<storeFile.Resume | undefined> {
  return useDb ? storeDb.getResume(id) : storeFile.getResume(id);
}

export async function getFirstResumeId(): Promise<string | undefined> {
  return useDb ? storeDb.getFirstResumeId() : storeFile.getFirstResumeId();
}

export async function createResume(
  candidate: Candidate,
  projects: Project[],
  extra?: { rawText?: string; pageImages?: string[] }
): Promise<storeFile.Resume> {
  return useDb ? storeDb.createResume(candidate, projects, extra) : storeFile.createResume(candidate, projects, extra);
}

export async function updateResume(
  id: string,
  candidate: Candidate,
  projects: Project[]
): Promise<storeFile.Resume | undefined> {
  return useDb ? storeDb.updateResume(id, candidate, projects) : storeFile.updateResume(id, candidate, projects);
}

export async function deleteResume(id: string): Promise<boolean> {
  const ok = useDb ? await storeDb.deleteResume(id) : await storeFile.deleteResume(id);
  if (ok && !useDb) await storeFile.deleteResumePdf(id);
  return ok;
}

export async function saveResumePdf(resumeId: string, buffer: Buffer): Promise<void> {
  if (useDb) await storeDb.saveResumePdf(resumeId, buffer);
  else await storeFile.saveResumePdf(resumeId, buffer);
}

export async function getResumePdf(resumeId: string): Promise<Buffer | null> {
  return useDb ? storeDb.getResumePdf(resumeId) : storeFile.getResumePdf(resumeId);
}

export async function deleteResumePdf(resumeId: string): Promise<void> {
  if (!useDb) await storeFile.deleteResumePdf(resumeId);
  // DB: resume_pdfs 通过 ON DELETE CASCADE 随 resume 删除
}
