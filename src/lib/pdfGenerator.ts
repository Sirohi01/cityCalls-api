// PDF generation seam — docs/16-pdf-and-financial-documents.md §5 specifies
// server-side HTML-to-PDF (e.g. Puppeteer). Actually rendering PDFs isn't
// implemented in this environment (Puppeteer needs a bundled Chromium download,
// impractical here); this function is the single call site every financial
// document's "generate/share" action goes through, so wiring in a real renderer
// later is a one-file change. For now it deterministically produces a URL-shaped
// placeholder so the rest of the system (pdfUrl field, share/email flows) can be
// built and tested against a stable contract ahead of the real renderer landing.
export async function generateDocumentPdf(documentType: string, documentId: string): Promise<string> {
  return `/generated-pdfs/${documentType.toLowerCase()}/${documentId}.pdf`;
}
