import * as XLSX from 'xlsx';

// Shared by every entity in the export registry (src/modules/import-export) —
// deliberately generic rather than hand-flattened per entity: nested arrays
// (Customer.addresses, Lead.notes, etc.) round-trip as compact JSON in a
// single cell rather than being exploded into per-field columns. Documented
// trade-off, matching this project's pattern of pragmatic scope decisions
// (docs/15-excel-import-export-specification.md doesn't specify a flattening
// convention for nested arrays) — a spreadsheet consumer gets every field,
// just not always in a fully "flat" shape for nested collections.
export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function flattenValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== 'object' || v === null)) {
      return value.map((v) => flattenValue(v)).join('; ');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    // Mongoose ObjectId and similar wrapper types stringify meaningfully via toString().
    const asString = (value as { toString?: () => string }).toString?.();
    if (asString && asString !== '[object Object]') return asString;
    return JSON.stringify(value);
  }
  return String(value);
}

export function toRows(docs: Record<string, unknown>[], columns: string[]): string[][] {
  return docs.map((doc) => columns.map((col) => flattenValue(getPath(doc, col))));
}

function escapeCsvCell(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function buildCsv(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return lines.join('\r\n');
}

export function buildXlsx(header: string[], rows: string[][]): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// Import intentionally does NOT use XLSX.read/sheet_to_json — the installed
// `xlsx` package (SheetJS, pinned to 0.18.5, the last version published to
// the public npm registry) has two unpatched high-severity advisories in
// its parsing path (GHSA-4r6h-8v6p-xvw6 prototype pollution, GHSA-5pgg-2g8v-p4x9
// ReDoS), and import is exactly "parse a file an authenticated-but-arbitrary
// user uploaded" — the highest-risk place to exercise a vulnerable parser.
// XLSX.write (buildXlsx above) is fine to keep: we generate that file
// ourselves from trusted internal data, never parse untrusted input with it.
// So: export supports csv|xlsx, import supports CSV only, hand-parsed here
// with no third-party dependency. Revisit if/when SheetJS ships a patched
// release, or before a real customer-facing deployment (Phase 11 security review).
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

// Splits on real record boundaries (newlines outside a quoted field) rather
// than a naive buffer.split('\n'), since a quoted cell may itself contain
// embedded newlines (RFC 4180).
function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') inQuotes = !inQuotes;
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current.length > 0) records.push(current);
      current = '';
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else {
      current += char;
    }
  }
  if (current.length > 0) records.push(current);
  return records;
}

export function parseCsv(buffer: Buffer): { header: string[]; rows: string[][] } {
  const text = buffer.toString('utf-8');
  const records = splitCsvRecords(text);
  const [headerLine, ...rowLines] = records;
  const header = (headerLine ? parseCsvLine(headerLine) : []).map((h) => h.trim());
  const rows = rowLines.map((line) => parseCsvLine(line));
  return { header, rows };
}
