import { Response, NextFunction } from 'express';
import * as customerService from './customers.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError, NotFoundError } from '../../lib/errors';
function assertOwnCustomer(
  customer: { userId?: { toString(): string } | string },
  req: ScopedRequest
): void {
  if (req.scope !== 'OWN') return;
  const ownerId = customer.userId?.toString();
  if (!req.user || ownerId !== req.user.sub) {
    throw new NotFoundError('Customer not found');
  }
}

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
    assertOwnCustomer(customer, req);
    sendSuccess(res, customer, 'Customer fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function getOwnCustomerHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const customer = await customerService.findOrCreateOwnCustomer(req.user.sub);
    sendSuccess(res, customer, 'Customer profile fetched successfully');
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
    const result = await customerService.createCustomer(req.body);
    const message =
      result.potentialDuplicates.length > 0
        ? 'Customer created successfully — review potential duplicates'
        : 'Customer created successfully';
    sendSuccess(res, result, message, null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateCustomerHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const id = paramAsString(req.params.id);
    assertOwnCustomer(await customerService.getCustomer(id), req);
    const customer = await customerService.updateCustomer(id, req.body);
    sendSuccess(res, customer, 'Customer updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function addAddressHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const id = paramAsString(req.params.id);
    assertOwnCustomer(await customerService.getCustomer(id), req);
    const customer = await customerService.addAddress(id, req.body);
    sendSuccess(res, customer, 'Address added successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateAddressHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const id = paramAsString(req.params.id);
    assertOwnCustomer(await customerService.getCustomer(id), req);
    const customer = await customerService.updateAddress(id, paramAsString(req.params.addressId), req.body);
    sendSuccess(res, customer, 'Address updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteAddressHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const id = paramAsString(req.params.id);
    assertOwnCustomer(await customerService.getCustomer(id), req);
    const customer = await customerService.deleteAddress(id, paramAsString(req.params.addressId));
    sendSuccess(res, customer, 'Address deleted successfully');
  } catch (err) {
    next(err);
  }
}

export async function getCustomerHistoryHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const id = paramAsString(req.params.id);
    assertOwnCustomer(await customerService.getCustomer(id), req);
    const history = await customerService.getCustomerHistory(id);
    sendSuccess(res, history, 'Customer history fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function addProductHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const id = paramAsString(req.params.id);
    assertOwnCustomer(await customerService.getCustomer(id), req);
    const product = await customerService.addProduct(id, req.body);
    sendSuccess(res, product, 'Product added successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function listProductsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const id = paramAsString(req.params.id);
    assertOwnCustomer(await customerService.getCustomer(id), req);
    const products = await customerService.listProducts(id);
    sendSuccess(res, products, 'Products fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateConsentHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    assertOwnCustomer(await customerService.getCustomer(id), req);
    const { channel, state, reason } = req.body as { channel: 'whatsapp' | 'email' | 'sms'; state: 'GRANTED' | 'REVOKED' | 'NOT_ASKED'; reason?: string };
    const customer = await customerService.updateConsent(id, channel, state, reason, req.user);
    sendSuccess(res, customer, 'Consent updated successfully');
  } catch (err) {
    next(err);
  }
}
