import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(3, 'Enter an email or mobile number'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const otpRequestSchema = z.object({
  mobile: z.string().min(10, 'Enter a valid mobile number'),
});

export const otpVerifySchema = z.object({
  mobile: z.string().min(10, 'Enter a valid mobile number'),
  otp: z.string().length(6, 'Enter the 6-digit OTP'),
});

export const passwordResetRequestSchema = z.object({
  identifier: z.string().min(3, 'Enter an email or mobile number'),
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
