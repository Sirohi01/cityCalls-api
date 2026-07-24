import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware/error.middleware';
import { generalApiRateLimit } from './middleware/rateLimit.middleware';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import organizationRoutes from './modules/organization/organization.routes';
import configRoutes from './modules/config/config.routes';
import employeesRoutes from './modules/employees/employees.routes';
import vendorsRoutes from './modules/vendors/vendors.routes';
import customersRoutes from './modules/customers/customers.routes';
import catalogRoutes from './modules/catalog/catalog.routes';
import callsRoutes from './modules/calls/calls.routes';
import leadsRoutes from './modules/leads/leads.routes';
import serviceRequestsRoutes from './modules/service-requests/serviceRequests.routes';
import filesRoutes from './modules/files/files.routes';
import serviceVisitsRoutes from './modules/field-execution/serviceVisits.routes';
import financeRoutes from './modules/finance/finance.routes';
import vendorFinanceRoutes from './modules/vendors/vendorFinance.routes';
import happyCallsRoutes from './modules/follow-up/happyCalls.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import campaignsRoutes from './modules/marketing/campaigns.routes';
import aiRoutes from './modules/ai/ai.routes';
import reportsRoutes from './modules/reports/reports.routes';
import exportRoutes from './modules/import-export/export.routes';
import importRoutes from './modules/import-export/import.routes';
import auditRoutes from './modules/audit/audit.routes';
import searchRoutes from './modules/search/search.routes';
import geoRoutes from './modules/geo/geo.routes';
import complaintsRoutes from './modules/complaints/complaints.routes';

export function createApp(): Application {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsAllowedOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use('/api/v1', generalApiRateLimit);
  // Serves files saved by the local fallback upload adapter (lib/fileStorage.ts) —
  // unused when Cloudinary is enabled, since those URLs point at Cloudinary directly.
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'ok', data: { env: env.nodeEnv }, meta: null, errors: null });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', usersRoutes);
  app.use('/api/v1', organizationRoutes);
  app.use('/api/v1', configRoutes);
  app.use('/api/v1', employeesRoutes);
  app.use('/api/v1', vendorsRoutes);
  app.use('/api/v1', customersRoutes);
  app.use('/api/v1', catalogRoutes);
  app.use('/api/v1', callsRoutes);
  app.use('/api/v1', leadsRoutes);
  app.use('/api/v1', serviceRequestsRoutes);
  app.use('/api/v1', filesRoutes);
  app.use('/api/v1', serviceVisitsRoutes);
  app.use('/api/v1', financeRoutes);
  app.use('/api/v1', vendorFinanceRoutes);
  app.use('/api/v1', happyCallsRoutes);
  app.use('/api/v1', notificationsRoutes);
  app.use('/api/v1', campaignsRoutes);
  app.use('/api/v1', aiRoutes);
  app.use('/api/v1', reportsRoutes);
  app.use('/api/v1', exportRoutes);
  app.use('/api/v1', importRoutes);
  app.use('/api/v1', auditRoutes);
  app.use('/api/v1', searchRoutes);
  app.use('/api/v1', geoRoutes);
  app.use('/api/v1', complaintsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
