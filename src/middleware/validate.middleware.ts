import { NextFunction, Request, Response } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '../lib/apiResponse';

type RequestPart = 'body' | 'query' | 'params';

// Per docs/10-api-standards.md §10: every request body is validated server-side
// with a Zod schema before reaching business logic.
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const zodError = result.error as ZodError;
      const errors: ApiError[] = zodError.issues.map((issue) => ({
        field: issue.path.join('.') || part,
        code: issue.code.toUpperCase(),
        message: issue.message,
      }));
      res.status(422).json({
        success: false,
        message: 'Validation failed',
        data: null,
        errors,
      });
      return;
    }
    // Express 5 made `req.query` a getter-only accessor (lazily parsed from
    // req.url) — a plain `req.query = result.data` throws
    // "Cannot set property query of #<IncomingMessage> which has only a getter".
    // Redefining the property descriptor replaces the accessor with a plain
    // writable data property, which works for query/params/body alike.
    Object.defineProperty(req, part, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
