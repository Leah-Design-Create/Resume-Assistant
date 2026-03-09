/**
 * 从 PDF Buffer 提取文本（使用 pdf-parse）
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; numPages: number }> {
  const mod = await import('pdf-parse');
  const pdfParse = (mod as { default?: (buf: Buffer) => Promise<{ text: string; numpages: number }> }).default ?? mod as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
  const data = await pdfParse(buffer);
  return { text: data?.text ?? '', numPages: data?.numpages ?? 0 };
}
