import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware/error.middleware';
import { generalApiRateLimit } from './middleware/rateLimit.middleware';
import authRoutes from './modules/auth/auth.routes';
import organizationRoutes from './modules/organization/organization.routes';
import configRoutes from './modules/config/config.routes';
import employeesRoutes from './modules/employees/employees.routes';
import vendorsRoutes from './modules/vendors/vendors.routes';
import customersRoutes from './modules/customers/customers.routes';
import catalogRoutes from './modules/catalog/catalog.routes';

export function createApp(): Application {
  const app = express();

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

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'ok', data: { env: env.nodeEnv }, meta: null, errors: null });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', organizationRoutes);
  app.use('/api/v1', configRoutes);
  app.use('/api/v1', employeesRoutes);
  app.use('/api/v1', vendorsRoutes);
  app.use('/api/v1', customersRoutes);
  app.use('/api/v1', catalogRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
