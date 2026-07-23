import { Response, NextFunction } from 'express';
import * as orgService from './organization.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function listBranchesHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const { items, meta } = await orgService.listBranches(req.query as never, req.scope, req.user);
    sendSuccess(res, items, 'Branches fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getBranchHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const branch = await orgService.getBranch(paramAsString(req.params.id));
    sendSuccess(res, branch, 'Branch fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function createBranchHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const branch = await orgService.createBranch(req.body);
    sendSuccess(res, branch, 'Branch created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateBranchHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const branch = await orgService.updateBranch(paramAsString(req.params.id), req.body);
    sendSuccess(res, branch, 'Branch updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteBranchHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    await orgService.deleteBranch(paramAsString(req.params.id));
    sendSuccess(res, null, 'Branch deleted successfully');
  } catch (err) {
    next(err);
  }
}

export async function listSubBranchesHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const branchId = req.query.branchId as string | undefined;
    const { items, meta } = await orgService.listSubBranches(branchId, req.query as never, req.scope, req.user);
    sendSuccess(res, items, 'Sub-branches fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function createSubBranchHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const subBranch = await orgService.createSubBranch(req.body);
    sendSuccess(res, subBranch, 'Sub-branch created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateSubBranchHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const subBranch = await orgService.updateSubBranch(paramAsString(req.params.id), req.body);
    sendSuccess(res, subBranch, 'Sub-branch updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteSubBranchHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    await orgService.deleteSubBranch(paramAsString(req.params.id));
    sendSuccess(res, null, 'Sub-branch deleted successfully');
  } catch (err) {
    next(err);
  }
}

export async function listTeamsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const branchId = req.query.branchId as string | undefined;
    const { items, meta } = await orgService.listTeams(branchId, req.query as never, req.scope, req.user);
    sendSuccess(res, items, 'Teams fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function createTeamHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const team = await orgService.createTeam(req.body);
    sendSuccess(res, team, 'Team created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateTeamHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const team = await orgService.updateTeam(paramAsString(req.params.id), req.body);
    sendSuccess(res, team, 'Team updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteTeamHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    await orgService.deleteTeam(paramAsString(req.params.id));
    sendSuccess(res, null, 'Team deleted successfully');
  } catch (err) {
    next(err);
  }
}
