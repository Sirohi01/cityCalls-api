import { CustomerModel } from '../customers/customers.model';
import { EmployeeModel } from '../employees/employees.model';
import { UserModel } from '../users/users.model';
import { VendorModel, VendorTechnicianModel } from '../vendors/vendors.model';
import { CampaignRecipientType, ICampaign } from './campaigns.model';
import { normalizeWhatsAppDestination } from '../../lib/whatsappAdapter';

export interface ResolvedCampaignRecipient {
  recipientType: CampaignRecipientType;
  recipientId: string;
  name: string;
  mobile?: string;
  email?: string;
  eligible: boolean;
  exclusionReason?: 'NO_CONTACT' | 'NO_CONSENT' | 'MANUALLY_EXCLUDED' | 'DUPLICATE';
}

export interface AudiencePreview {
  matchedRecords: number;
  uniqueContacts: number;
  eligible: number;
  noConsent: number;
  noContact: number;
  manuallyExcluded: number;
  duplicatesRemoved: number;
  sample: ResolvedCampaignRecipient[];
}

type CampaignAudienceInput = Pick<ICampaign, 'channel' | 'audienceFilter'>;

function normalizeForDedupe(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return normalizeWhatsAppDestination(value);
  } catch {
    return value.trim().toLowerCase();
  }
}

export async function resolveCampaignAudience(campaign: CampaignAudienceInput): Promise<ResolvedCampaignRecipient[]> {
  const types = new Set(campaign.audienceFilter.recipientTypes);
  const candidates: ResolvedCampaignRecipient[] = [];
  const whatsapp = campaign.channel === 'WHATSAPP';

  if (types.has('MANUAL') && whatsapp) {
    for (const [index, mobile] of (campaign.audienceFilter.manualMobiles ?? []).entries()) {
      try {
        const normalized = normalizeWhatsAppDestination(mobile);
        candidates.push({ recipientType: 'MANUAL', recipientId: `manual:${index}`, name: 'Customer', mobile: normalized, eligible: true });
      } catch {
        candidates.push({ recipientType: 'MANUAL', recipientId: `manual:${index}`, name: 'Customer', mobile, eligible: false, exclusionReason: 'NO_CONTACT' });
      }
    }
  }

  if (types.has('CUSTOMER')) {
    const query: Record<string, unknown> = { blacklisted: { $ne: true } };
    if (campaign.audienceFilter.tags?.length) query.tags = { $in: campaign.audienceFilter.tags };
    if (campaign.audienceFilter.segments?.length) query.segments = { $in: campaign.audienceFilter.segments };
    if (campaign.audienceFilter.customerType) query.customerType = campaign.audienceFilter.customerType;
    const customers = await CustomerModel.find(query).lean();
    for (const customer of customers) {
      const contact = customer.contacts.find((item) => item.isPrimary) ?? customer.contacts[0];
      const destination = whatsapp ? contact?.mobile : customer.email;
      const consent = whatsapp ? customer.consent.whatsapp : customer.consent.email;
      candidates.push({
        recipientType: 'CUSTOMER',
        recipientId: customer._id.toString(),
        name: customer.name,
        mobile: contact?.mobile,
        email: customer.email,
        eligible: Boolean(destination) && consent === 'GRANTED',
        exclusionReason: !destination ? 'NO_CONTACT' : consent !== 'GRANTED' ? 'NO_CONSENT' : undefined,
      });
    }
  }

  const userQuery: Record<string, unknown> = { status: 'ACTIVE' };
  if (campaign.audienceFilter.roles?.length) userQuery.role = { $in: campaign.audienceFilter.roles };
  if (campaign.audienceFilter.branchIds?.length) userQuery.branchId = { $in: campaign.audienceFilter.branchIds };

  if (types.has('USER')) {
    const users = await UserModel.find(userQuery).lean();
    for (const user of users) {
      const destination = whatsapp ? user.mobile : user.email;
      const consent = whatsapp
        ? user.communicationConsent?.whatsappMarketing
        : user.communicationConsent?.emailMarketing;
      candidates.push({
        recipientType: 'USER',
        recipientId: user._id.toString(),
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        eligible: Boolean(destination) && consent === 'GRANTED',
        exclusionReason: !destination ? 'NO_CONTACT' : consent !== 'GRANTED' ? 'NO_CONSENT' : undefined,
      });
    }
  }

  if (types.has('EMPLOYEE')) {
    const employeeQuery: Record<string, unknown> = { active: true };
    if (campaign.audienceFilter.branchIds?.length) employeeQuery.branchId = { $in: campaign.audienceFilter.branchIds };
    const employees = await EmployeeModel.find(employeeQuery).populate('userId').lean();
    for (const employee of employees) {
      const user = employee.userId as unknown as {
        _id: { toString(): string };
        name: string;
        mobile: string;
        email?: string;
        role: string;
        communicationConsent?: { whatsappMarketing?: string; emailMarketing?: string };
      };
      if (!user || (campaign.audienceFilter.roles?.length && !campaign.audienceFilter.roles.includes(user.role as never))) continue;
      const destination = whatsapp ? user.mobile : user.email;
      const consent = whatsapp ? user.communicationConsent?.whatsappMarketing : user.communicationConsent?.emailMarketing;
      candidates.push({
        recipientType: 'EMPLOYEE',
        recipientId: employee._id.toString(),
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        eligible: Boolean(destination) && consent === 'GRANTED',
        exclusionReason: !destination ? 'NO_CONTACT' : consent !== 'GRANTED' ? 'NO_CONSENT' : undefined,
      });
    }
  }

  if (types.has('VENDOR')) {
    const vendorQuery: Record<string, unknown> = { active: true, blacklisted: { $ne: true } };
    if (campaign.audienceFilter.vendorIds?.length) vendorQuery._id = { $in: campaign.audienceFilter.vendorIds };
    const vendors = await VendorModel.find(vendorQuery).lean();
    for (const vendor of vendors) {
      vendor.contactPersons.forEach((contact, index) => {
        const destination = whatsapp ? contact.mobile : contact.email;
        const consent = whatsapp ? contact.whatsappMarketingConsent : contact.emailMarketingConsent;
        candidates.push({
          recipientType: 'VENDOR',
          recipientId: `${vendor._id.toString()}:${index}`,
          name: contact.name || vendor.companyName,
          mobile: contact.mobile,
          email: contact.email,
          eligible: Boolean(destination) && consent === 'GRANTED',
          exclusionReason: !destination ? 'NO_CONTACT' : consent !== 'GRANTED' ? 'NO_CONSENT' : undefined,
        });
      });
    }
  }

  if (types.has('VENDOR_TECHNICIAN')) {
    const technicianQuery: Record<string, unknown> = { active: true };
    if (campaign.audienceFilter.vendorIds?.length) technicianQuery.vendorId = { $in: campaign.audienceFilter.vendorIds };
    const technicians = await VendorTechnicianModel.find(technicianQuery).populate('userId').lean();
    for (const technician of technicians) {
      const user = technician.userId as unknown as {
        name: string;
        mobile: string;
        email?: string;
        communicationConsent?: { whatsappMarketing?: string; emailMarketing?: string };
      };
      if (!user) continue;
      const destination = whatsapp ? user.mobile : user.email;
      const consent = whatsapp ? user.communicationConsent?.whatsappMarketing : user.communicationConsent?.emailMarketing;
      candidates.push({
        recipientType: 'VENDOR_TECHNICIAN',
        recipientId: technician._id.toString(),
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        eligible: Boolean(destination) && consent === 'GRANTED',
        exclusionReason: !destination ? 'NO_CONTACT' : consent !== 'GRANTED' ? 'NO_CONSENT' : undefined,
      });
    }
  }

  const excluded = new Set((campaign.audienceFilter.excludeMobiles ?? []).map(normalizeForDedupe).filter(Boolean));
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const contact = normalizeForDedupe(whatsapp ? candidate.mobile : candidate.email);
    if (contact && excluded.has(contact)) {
      candidate.eligible = false;
      candidate.exclusionReason = 'MANUALLY_EXCLUDED';
    } else if (contact && seen.has(contact)) {
      candidate.eligible = false;
      candidate.exclusionReason = 'DUPLICATE';
    } else if (contact) {
      seen.add(contact);
    }
  }
  return candidates;
}

export function summarizeAudience(recipients: ResolvedCampaignRecipient[]): AudiencePreview {
  return {
    matchedRecords: recipients.length,
    uniqueContacts: recipients.filter((item) => item.exclusionReason !== 'DUPLICATE').length,
    eligible: recipients.filter((item) => item.eligible).length,
    noConsent: recipients.filter((item) => item.exclusionReason === 'NO_CONSENT').length,
    noContact: recipients.filter((item) => item.exclusionReason === 'NO_CONTACT').length,
    manuallyExcluded: recipients.filter((item) => item.exclusionReason === 'MANUALLY_EXCLUDED').length,
    duplicatesRemoved: recipients.filter((item) => item.exclusionReason === 'DUPLICATE').length,
    sample: recipients.filter((item) => item.eligible).slice(0, 20),
  };
}
