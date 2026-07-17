import { Response, NextFunction } from 'express';
import * as searchService from './search.service';
import { sendSuccess } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';

export async function globalSearchHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { q } = req.query as { q: string };
    const results = await searchService.globalSearch(q);
    sendSuccess(res, results, 'Search results fetched successfully');
  } catch (err) {
    next(err);
  }
}
