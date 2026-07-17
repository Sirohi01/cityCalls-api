import { Response, NextFunction } from 'express';
import * as userService from './users.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';

export async function listUsersHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await userService.listUsers(req.query as never);
    // Never return passwordHash — the schema already excludes it via `select: false`,
    // this is a defense-in-depth strip in case a future query opts it back in.
    const safeItems = items.map((u) => {
      const obj = u.toObject();
      delete (obj as { passwordHash?: string }).passwordHash;
      return obj;
    });
    sendSuccess(res, safeItems, 'Users fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getUserHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const user = await userService.getUser(paramAsString(req.params.id));
    sendSuccess(res, user, 'User fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function createUserHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const user = await userService.createUser(req.body);
    const obj = user.toObject();
    delete (obj as { passwordHash?: string }).passwordHash;
    sendSuccess(res, obj, 'User created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateUserHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const user = await userService.updateUser(paramAsString(req.params.id), req.body);
    sendSuccess(res, user, 'User updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function listRolesHandler(_req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const mockRoles = [
      { id: 'ROLE-01', name: 'Super Admin', description: 'Full access', permissions: ['*'] },
      { id: 'ROLE-02', name: 'Technician', description: 'Field worker', permissions: ['view_tasks', 'update_tasks'] },
      { id: 'ROLE-03', name: 'Dispatcher', description: 'Assigns tasks', permissions: ['view_tasks', 'assign_tasks'] },
    ];
    sendSuccess(res, mockRoles, 'Roles fetched successfully');
  } catch (err) {
    next(err);
  }
}
