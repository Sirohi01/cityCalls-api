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
    const employee = await employeeService.updateEmployee(paramAsString(req.params.id), req.body);
    sendSuccess(res, employee, 'Employee updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteEmployeeHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    await employeeService.deleteEmployee(paramAsString(req.params.id));
    sendSuccess(res, null, 'Employee deleted successfully');
  } catch (err) {
    next(err);
  }
}
