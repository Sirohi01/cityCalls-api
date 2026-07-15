import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

// docs/14-integration-architecture.md §3: routes through the configured SMTP
// account when enabled; when disabled, the caller (notifications.ts) records
// SKIPPED_INTEGRATION_DISABLED rather than calling this at all — this module
// only concerns itself with "how to actually send," not the enabled/disabled
// decision, matching the adapter-selection pattern in docs/14 §1.
let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export function isEmailEnabled(): boolean {
  return env.smtp.enabled && !!env.smtp.host;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  await getTransporter().sendMail({
    from: process.env.SMTP_SENDER_EMAIL ?? 'no-reply@citycalls.local',
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
