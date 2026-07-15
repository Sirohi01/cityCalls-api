import { ZodError } from 'zod';
import { IMPORT_REGISTRY, ImportEntity } from './importRegistry';
import { parseCsv } from '../../lib/exportBuilder';
import { NotFoundError, ValidationError } from '../../lib/errors';

export interface ImportRowFailure {
  row: number; // 1-based spreadsheet row number, header excluded (row 1 = first data row)
  field: string;
  code: string;
  message: string;
  rawValue?: unknown;
}

export interface ImportResult {
  successCount: number;
  failureCount: number;
  failures: ImportRowFailure[];
  createdIds: string[];
  dryRun: boolean;
}

export interface ImportOptions {
  dryRun: boolean;
  mode: 'partial' | 'strict';
}

function rowToObject(header: string[], row: unknown[]): Record<string, string> {
  const obj: Record<string, string> = {};
  header.forEach((key, i) => {
    obj[key] = row[i] === undefined || row[i] === null ? '' : String(row[i]);
  });
  return obj;
}

// docs/15-excel-import-export-specification.md §2/§5: validates every row
// with the same Zod schema as that entity's create endpoint, supports
// ?dryRun=true and ?mode=partial|strict (partial default — commit valid
// rows, report the rest), and returns the documented
// {successCount, failureCount, failures[]} error envelope
// (03-screenshot-and-excel-analysis.md §7). `strict` mode is enforced by
// validating every row before writing any of them (rather than a real
// multi-document transaction, which a standalone-mongod dev environment
// can't guarantee) — a runtime creation error (e.g. a uniqueness
// constraint) after that point is still recorded as a per-row failure in
// both modes rather than rolled back, a documented limitation.
//
// CSV only, not .xlsx — see the comment on parseCsv in lib/exportBuilder.ts:
// the `xlsx` package's parser has unpatched high-severity advisories, and
// this endpoint parses arbitrary user-uploaded files, so it deliberately
// never calls into that code path.
export async function importEntity(entity: string, buffer: Buffer, options: ImportOptions): Promise<ImportResult> {
  const def = IMPORT_REGISTRY[entity as ImportEntity];
  if (!def) {
    throw new NotFoundError(`Unknown import entity: ${entity}`);
  }

  const { header, rows } = parseCsv(buffer);
  if (header.length === 0) {
    throw new ValidationError([{ field: 'file', code: 'EMPTY_FILE', message: 'The uploaded file has no header row' }]);
  }

  const failures: ImportRowFailure[] = [];
  const validRows: { rowNumber: number; data: Record<string, unknown> }[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const rawRow = rowToObject(header, row);
    // A fully blank trailing row (common at the end of a spreadsheet) isn't a failure — skip it silently.
    if (Object.values(rawRow).every((v) => v === '')) return;

    const transformed = def.transformRow(rawRow);
    const result = def.schema.safeParse(transformed);
    if (!result.success) {
      const zodError = result.error as ZodError;
      for (const issue of zodError.issues) {
        failures.push({
          row: rowNumber,
          field: issue.path.join('.') || '(row)',
          code: issue.code,
          message: issue.message,
          rawValue: rawRow,
        });
      }
      return;
    }
    validRows.push({ rowNumber, data: result.data as Record<string, unknown> });
  });

  if (options.mode === 'strict' && failures.length > 0) {
    return { successCount: 0, failureCount: failures.length, failures, createdIds: [], dryRun: options.dryRun };
  }

  if (options.dryRun) {
    return { successCount: validRows.length, failureCount: failures.length, failures, createdIds: [], dryRun: true };
  }

  const createdIds: string[] = [];
  for (const { rowNumber, data } of validRows) {
    try {
      const created = (await def.create(data)) as { _id: { toString(): string } };
      createdIds.push(created._id.toString());
    } catch (err) {
      failures.push({
        row: rowNumber,
        field: '(row)',
        code: 'CREATE_FAILED',
        message: err instanceof Error ? err.message : 'Failed to create record',
        rawValue: data,
      });
    }
  }

  return { successCount: createdIds.length, failureCount: failures.length, failures, createdIds, dryRun: false };
}
