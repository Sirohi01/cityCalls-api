import { Response, NextFunction } from 'express';
import * as employeeService from './employees.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function listEmployeesHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const { items, meta } = await employeeService.listEmployees(req.query as never, req.scope, req.user);
    sendSuccess(res, items, 'Employees fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getOwnEmployeeHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const employee = await employeeService.getOwnEmployee(req.user.sub);
    sendSuccess(res, employee, 'Employee fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function registerFcmTokenHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { token } = req.body as { token: string };
    const employee = await employeeService.registerFcmToken(req.user.sub, token);
    sendSuccess(res, employee, 'Push token registered successfully');
  } catch (err) {
    next(err);
  }
}

export async function unregisterFcmTokenHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { token } = req.body as { token: string };
    const employee = await employeeService.unregisterFcmToken(req.user.sub, token);
    sendSuccess(res, employee, 'Push token unregistered successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateOwnAvailabilityHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { availability } = req.body as { availability: { day: number; available: boolean }[] };
    const employee = await employeeService.updateOwnAvailability(req.user.sub, availability);
    sendSuccess(res, employee, 'Availability updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const employee = await employeeService.getEmployee(paramAsString(req.params.id));
    sendSuccess(res, employee, 'Employee fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function createEmployeeHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const employee = await employeeService.createEmployee(req.body);
    sendSuccess(res, employee, 'Employee created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateEmployeeHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    await employeeService.assertEmployeeAccessInScope(await employeeService.getEmployee(id), req.scope, req.user);
    const employee = await employeeService.updateEmployee(id, req.body);
    sendSuccess(res, employee, 'Employee updated successfully');
  } catch (err) {
    next(err);
  }
}

// Admin/branch-manager equivalent of updateOwnAvailabilityHandler — same
// narrow {availability} payload, but scope-checked (BRANCH/ALL) instead of
// tied to the caller's own userId, so a manager can mark someone on leave.
export async function updateEmployeeAvailabilityHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    await employeeService.assertEmployeeAccessInScope(await employeeService.getEmployee(id), req.scope, req.user);
    const { availability } = req.body as { availability: { day: number; available: boolean }[] };
    const employee = await employeeService.updateEmployee(id, { availability });
    sendSuccess(res, employee, 'Availability updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteEmployeeHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    await employeeService.assertEmployeeAccessInScope(await employeeService.getEmployee(id), req.scope, req.user);
    await employeeService.deleteEmployee(id);
    sendSuccess(res, null, 'Employee deleted successfully');
  } catch (err) {
    next(err);
  }
}
