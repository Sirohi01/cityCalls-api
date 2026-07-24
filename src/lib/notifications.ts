import { NotificationTemplateModel, NotificationModel, NotificationChannel } from '../modules/notifications/notificationTemplates.model';
import { UserModel } from '../modules/users/users.model';
import { CustomerModel } from '../modules/customers/customers.model';
import { isEmailEnabled, sendEmail } from './emailAdapter';
import { isWhatsAppEnabled, sendWhatsApp } from './whatsappAdapter';
import { isPushEnabled, sendPush } from './pushAdapter';
import { emitNotificationNew } from '../realtime';

export interface TriggerRecipient {
  userId?: string;
  customerId?: string;
  mobile?: string;
  email?: string;
}

export interface TriggerContext {
  recipient: TriggerRecipient;
  variables: Record<string, unknown>;
}

function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

interface ResolvedContact {
  userId?: string;
  mobile?: string;
  email?: string;
  customerId?: string;
  fcmTokens?: string[];
}

async function resolveContact(recipient: TriggerRecipient): Promise<ResolvedContact> {
  const resolved: ResolvedContact = {
    userId: recipient.userId,
    mobile: recipient.mobile,
    email: recipient.email,
    customerId: recipient.customerId,
  };

  if (recipient.userId && (!resolved.mobile || !resolved.email)) {
    const user = await UserModel.findById(recipient.userId).lean();
    if (user) {
      resolved.mobile = resolved.mobile ?? user.mobile;
      resolved.email = resolved.email ?? user.email;
    }
  }

  if (recipient.customerId) {
    const customer = await CustomerModel.findById(recipient.customerId).lean();
    if (customer) {
      const primaryContact = customer.contacts.find((c) => c.isPrimary) ?? customer.contacts[0];
      resolved.mobile = resolved.mobile ?? primaryContact?.mobile;
      resolved.email = resolved.email ?? customer.email;
      resolved.userId = resolved.userId ?? customer.userId?.toString();
      resolved.fcmTokens = customer.fcmTokens;
    }
  }

  return resolved;
}

// Single entry point every domain module calls to notify someone — the real
// implementation of the seam docs/manish/05-module-wise-backend-plan.md
// §Notifications describes, and of what notificationStub.ts's
// sendPlaceholderNotification() was always meant to be swapped for (Phase 8).
// Never throws — a notification failure must never crash the triggering
// business operation, per docs/01-business-requirements-document.md §3.6.
export async function trigger(triggerKey: string, context: TriggerContext): Promise<void> {
  try {
    const templates = await NotificationTemplateModel.find({ triggerKey, active: true });
    if (templates.length === 0) return; // no template registered for this trigger yet — not an error, just nothing configured

    const contact = await resolveContact(context.recipient);

    for (const template of templates) {
      await deliverOne(template.channel, template._id.toString(), triggerKey, contact, template, context.variables);
    }
  } catch (err) {
    console.error(`[notifications] trigger('${triggerKey}') failed unexpectedly`, err);
  }
}

async function deliverOne(
  channel: NotificationChannel,
  templateId: string,
  triggerKey: string,
  contact: ResolvedContact,
  template: { bodyTemplate: string; subjectTemplate?: string },
  variables: Record<string, unknown>
): Promise<void> {
  const body = renderTemplate(template.bodyTemplate, variables);
  const subject = template.subjectTemplate ? renderTemplate(template.subjectTemplate, variables) : undefined;

  const notification = await NotificationModel.create({
    templateId,
    triggerKey,
    channel,
    recipientUserId: contact.userId,
    recipientMobile: contact.mobile,
    recipientEmail: contact.email,
    subject,
    body,
    status: 'PENDING',
  });

  try {
    switch (channel) {
      case 'IN_APP': {
        if (!contact.userId) {
          notification.status = 'FAILED';
          notification.failureReason = 'No recipient userId to deliver an in-app notification to';
          break;
        }
        notification.status = 'SENT';
        notification.sentAt = new Date();
        emitNotificationNew(contact.userId, { notificationId: notification._id.toString(), triggerKey, body });
        break;
      }
      case 'EMAIL': {
        if (!isEmailEnabled()) {
          notification.status = 'SKIPPED_INTEGRATION_DISABLED';
        } else if (!contact.email) {
          notification.status = 'FAILED';
          notification.failureReason = 'No recipient email address available';
        } else {
          await sendEmail({ to: contact.email, subject: subject ?? triggerKey, html: body });
          notification.status = 'SENT';
          notification.sentAt = new Date();
        }
        break;
      }
      case 'WHATSAPP': {
        if (!isWhatsAppEnabled()) {
          notification.status = 'SKIPPED_INTEGRATION_DISABLED';
        } else if (!contact.mobile) {
          notification.status = 'FAILED';
          notification.failureReason = 'No recipient mobile number available';
        } else {
          await sendWhatsApp({ to: contact.mobile, templateName: triggerKey, variables: Object.values(variables).map(String) });
          notification.status = 'SENT';
          notification.sentAt = new Date();
        }
        break;
      }
      case 'PUSH': {
        if (!isPushEnabled()) {
          notification.status = 'SKIPPED_INTEGRATION_DISABLED';
        } else if (!contact.fcmTokens || contact.fcmTokens.length === 0) {
          notification.status = 'FAILED';
          notification.failureReason = 'No push token registered for recipient';
        } else {
          const result = await sendPush({ tokens: contact.fcmTokens, title: subject ?? 'CityCalls', body, data: { triggerKey } });
          if (result.invalidTokens.length > 0 && contact.customerId) {
            await CustomerModel.updateOne({ _id: contact.customerId }, { $pull: { fcmTokens: { $in: result.invalidTokens } } });
          }
          if (result.successCount > 0) {
            notification.status = 'SENT';
            notification.sentAt = new Date();
          } else {
            notification.status = 'FAILED';
            notification.failureReason = 'All tokens rejected by FCM';
          }
        }
        break;
      }
      case 'SMS':
        // Interface-ready, no provider selected yet — docs/14-integration-architecture.md §6-7.
        notification.status = 'SKIPPED_INTEGRATION_DISABLED';
        break;
    }
  } catch (err) {
    notification.status = 'FAILED';
    notification.failureReason = err instanceof Error ? err.message : 'Unknown delivery error';
  }

  await notification.save();
}
