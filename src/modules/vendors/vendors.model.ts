import { Schema, model, Document, Types } from 'mongoose';

// docs/09-database-architecture.md §2 "vendors" / "vendor_technicians".
export interface IVendor extends Document {
  companyName: string;
  contactPersons: { name: string; mobile: string; role?: string }[];
  serviceAreas: { pinCodes: string[] };
  servicesOffered: Types.ObjectId[]; // Service refs
  brandsHandled: Types.ObjectId[]; // Master (BRAND) refs
  productTypesHandled: Types.ObjectId[]; // Master (PRODUCT_TYPE) refs
  skills: string[];
  gst?: string;
  pan?: string;
  bankDetails?: { accountNumber: string; ifsc: string; accountHolderName: string };
  agreement?: { url: string; expiryDate: Date };
  commissionModel: 'FIXED' | 'SERVICE_WISE';
  commissionRate: number; // percent, applied flat when commissionModel is FIXED — docs/manish/05 §Vendors: per-service rates are a documented extension, not built yet
  active: boolean;
  blacklisted: boolean;
  blacklistReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<IVendor>(
  {
    companyName: { type: String, required: true, trim: true },
    contactPersons: [{ name: String, mobile: String, role: String }],
    serviceAreas: { pinCodes: { type: [String], default: [] } },
    servicesOffered: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
    brandsHandled: [{ type: Schema.Types.ObjectId, ref: 'Master' }],
    productTypesHandled: [{ type: Schema.Types.ObjectId, ref: 'Master' }],
    skills: { type: [String], default: [] },
    gst: { type: String },
    pan: { type: String },
    bankDetails: {
      accountNumber: String,
      ifsc: String,
      accountHolderName: String,
    },
    agreement: { url: String, expiryDate: Date },
    commissionModel: { type: String, enum: ['FIXED', 'SERVICE_WISE'], default: 'FIXED' },
    commissionRate: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    blacklisted: { type: Boolean, default: false },
    blacklistReason: { type: String },
  },
  { timestamps: true }
);

vendorSchema.index({ 'serviceAreas.pinCodes': 1 });
vendorSchema.index({ active: 1, blacklisted: 1 });

export const VendorModel = model<IVendor>('Vendor', vendorSchema);

export interface IVendorTechnician extends Document {
  userId: Types.ObjectId;
  vendorId: Types.ObjectId;
  skills: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vendorTechnicianSchema = new Schema<IVendorTechnician>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    skills: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

vendorTechnicianSchema.index({ vendorId: 1 });

export const VendorTechnicianModel = model<IVendorTechnician>('VendorTechnician', vendorTechnicianSchema);
