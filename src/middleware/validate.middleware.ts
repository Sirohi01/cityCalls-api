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
    req[part] = result.data;
    next();
  };
}
