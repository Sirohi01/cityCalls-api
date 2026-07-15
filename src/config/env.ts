import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: required('NODE_ENV', 'development'),
  port: parseInt(required('PORT', '4000'), 10),
  mongodbUri: required('MONGODB_URI', 'mongodb://localhost:27017/citycalls'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  jwtAccessExpiresIn: required('JWT_ACCESS_EXPIRES_IN', '15m'),
  jwtRefreshExpiresIn: required('JWT_REFRESH_EXPIRES_IN', '7d'),
  corsAllowedOrigins: required('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(','),
  redisUrl: process.env.REDIS_URL,
  cloudinary: {
    enabled: process.env.CLOUDINARY_ENABLED === 'true',
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  smtp: {
    enabled: process.env.SMTP_ENABLED === 'true',
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  aisensy: {
    enabled: process.env.AISENSY_ENABLED === 'true',
    apiKey: process.env.AISENSY_API_KEY,
  },
  ai: {
    enabled: process.env.AI_ENABLED === 'true',
    provider: process.env.AI_PROVIDER, // 'gemini' | 'openai'
    geminiApiKey: process.env.GEMINI_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  },
} as const;

if (env.nodeEnv === 'production') {
  const insecureDefaults = ['dev-access-secret-change-me', 'dev-refresh-secret-change-me'];
  if (insecureDefaults.includes(env.jwtAccessSecret) || insecureDefaults.includes(env.jwtRefreshSecret)) {
    throw new Error('Refusing to start in production with default JWT secrets. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.');
  }
}
