import { Schema, model, Document, Types } from 'mongoose';

// docs/09-database-architecture.md §2 "customers" / "customer_products".
export const CONSENT_STATES = ['GRANTED', 'REVOKED', 'NOT_ASKED'] as const;
export type ConsentState = (typeof CONSENT_STATES)[number];

interface IContact {
  name: string;
  mobile: string;
  isPrimary: boolean;
}

interface IAddress extends Types.Subdocument {
  label?: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
  isDefault: boolean;
  geo?: { lat: number; lng: number };
}

export interface ICustomer extends Document {
  userId?: Types.ObjectId;
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  name: string;
  businessName?: string;
  gstin?: string;
  contacts: IContact[];
  addresses: Types.DocumentArray<IAddress>;
  tags: string[];
  segments: string[];
  notes: string[];
  consent: {
    whatsapp: ConsentState;
    email: ConsentState;
    sms: ConsentState;
  };
  blacklisted: boolean;
  duplicateOfCustomerId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    customerType: { type: String, enum: ['INDIVIDUAL', 'BUSINESS'], default: 'INDIVIDUAL' },
    name: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true },
    gstin: { type: String, trim: true },
    contacts: [
      {
        name: String,
        mobile: { type: String, required: true },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    addresses: [
      {
        label: String,
        line1: { type: String, required: true },
        line2: String,
        landmark: String,
        city: { type: String, required: true },
        state: { type: String, required: true },
        pinCode: { type: String, required: true },
        country: { type: String, default: 'India' },
        isDefault: { type: Boolean, default: false },
        geo: { lat: Number, lng: Number },
      },
    ],
    tags: { type: [String], default: [] },
    segments: { type: [String], default: [] },
    notes: { type: [String], default: [] },
    consent: {
      whatsapp: { type: String, enum: CONSENT_STATES, default: 'NOT_ASKED' },
      email: { type: String, enum: CONSENT_STATES, default: 'NOT_ASKED' },
      sms: { type: String, enum: CONSENT_STATES, default: 'NOT_ASKED' },
    },
    blacklisted: { type: Boolean, default: false },
    duplicateOfCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  },
  { timestamps: true }
);

customerSchema.index({ 'contacts.mobile': 1 });
customerSchema.index({ 'addresses.pinCode': 1 });
customerSchema.index({ name: 'text' });

export const CustomerModel = model<ICustomer>('Customer', customerSchema);

export interface ICustomerProduct extends Document {
  customerId: Types.ObjectId;
  brandId: Types.ObjectId;
  productTypeId: Types.ObjectId;
  modelNumber?: string;
  serialNumber?: string;
  purchaseDate?: Date;
  warrantyExpiresAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerProductSchema = new Schema<ICustomerProduct>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Master', required: true },
    productTypeId: { type: Schema.Types.ObjectId, ref: 'Master', required: true },
    modelNumber: { type: String },
    serialNumber: { type: String },
    purchaseDate: { type: Date },
    warrantyExpiresAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

customerProductSchema.index({ customerId: 1 });
customerProductSchema.index({ serialNumber: 1 });

export const CustomerProductModel = model<ICustomerProduct>('CustomerProduct', customerProductSchema);
