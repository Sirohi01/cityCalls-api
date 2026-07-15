import { Response, NextFunction } from 'express';
import * as customerService from './customers.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function listCustomersHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await customerService.listCustomers(req.query as never);
    sendSuccess(res, items, 'Customers fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getCustomerHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const customer = await customerService.getCustomer(paramAsString(req.params.id));
    sendSuccess(res, customer, 'Customer fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function findDuplicatesHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { mobile, gstin, businessName, name } = req.query as Record<string, string | undefined>;
    const duplicates = await customerService.findDuplicates({ mobile, gstin, businessName, name });
    sendSuccess(res, duplicates, 'Potential duplicates fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function createCustomerHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const customer = await customerService.createCustomer(req.body);
    sendSuccess(res, customer, 'Customer created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateCustomerHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const customer = await customerService.updateCustomer(paramAsString(req.params.id), req.body);
    sendSuccess(res, customer, 'Customer updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function addAddressHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const customer = await customerService.addAddress(paramAsString(req.params.id), req.body);
    sendSuccess(res, customer, 'Address added successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function addProductHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const product = await customerService.addProduct(paramAsString(req.params.id), req.body);
    sendSuccess(res, product, 'Product added successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function listProductsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const products = await customerService.listProducts(paramAsString(req.params.id));
    sendSuccess(res, products, 'Products fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateConsentHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { channel, state, reason } = req.body as { channel: 'whatsapp' | 'email' | 'sms'; state: 'GRANTED' | 'REVOKED' | 'NOT_ASKED'; reason?: string };
    const customer = await customerService.updateConsent(paramAsString(req.params.id), channel, state, reason, req.user);
    sendSuccess(res, customer, 'Consent updated successfully');
  } catch (err) {
    next(err);
  }
}
