import { EXPORT_REGISTRY, ExportEntity } from './exportRegistry';
import { buildCsv, buildXlsx, toRows } from '../../lib/exportBuilder';
import { NotFoundError, ValidationError, ConflictError } from '../../lib/errors';
import { DataScope } from '../users/users.types';
import { AccessTokenPayload } from '../../lib/jwt';

// docs/15-excel-import-export-specification.md §1: exports above this
// threshold must run as a background job with a signed download link
// delivered via notification. That async pipeline is deferred here (no
// Redis/BullMQ in this environment, and no object-storage delivery target
// beyond the existing local-fallback/Cloudinary file adapters) — documented
// the same way PDF generation and the escalation job's queue-less
// setInterval fallback are: exports are synchronous and capped, not
// silently unbounded.
export const MAX_EXPORT_ROWS = 20_000;

export interface ExportResult {
  filename: string;
  contentType: string;
  body: string | Buffer;
}

export async function exportEntity(
  entity: string,
  format: 'csv' | 'xlsx',
  scope: DataScope,
  user: AccessTokenPayload,
  query: Record<string, string | undefined>,
  columns?: string[]
): Promise<ExportResult> {
  const def = EXPORT_REGISTRY[entity as ExportEntity];
  if (!def) {
    throw new NotFoundError(`Unknown export entity: ${entity}`);
  }

  const selectedColumns = columns && columns.length > 0 ? columns : def.defaultColumns;
  const invalidColumns = selectedColumns.filter((c) => !def.defaultColumns.includes(c));
  if (invalidColumns.length > 0) {
    throw new ValidationError([
      { field: 'columns', code: 'INVALID', message: `Unsupported column(s) for ${entity}: ${invalidColumns.join(', ')}` },
    ]);
  }

  const filter = def.buildFilter(scope, user, query);
  const total = await def.model.countDocuments(filter);
  if (total > MAX_EXPORT_ROWS) {
    throw new ConflictError(
      `Export would return ${total} rows, over the ${MAX_EXPORT_ROWS}-row synchronous export limit. Narrow your filters.`,
      'EXPORT_TOO_LARGE'
    );
  }

  const docs = await def.model.find(filter).lean();
  const rows = toRows(docs as unknown as Record<string, unknown>[], selectedColumns);
  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    return { filename: `${entity}_${timestamp}.csv`, contentType: 'text/csv', body: buildCsv(selectedColumns, rows) };
  }
  return {
    filename: `${entity}_${timestamp}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: buildXlsx(selectedColumns, rows),
  };
}
