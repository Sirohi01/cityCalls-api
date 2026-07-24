import '../src/config/env';
import mongoose from 'mongoose';
import { MasterModel } from '../src/modules/config/master.model';
import { ServiceModel } from '../src/modules/catalog/catalog.model';
import { FileModel } from '../src/modules/files/files.model';
import { UserModel } from '../src/modules/users/users.model';
import { BranchModel } from '../src/modules/organization/organization.model';

// Real catalog restructure per Manish's screenshot (2026-07-24) — 4 top-level
// customer-facing categories replace the previous 20 fine-grained demo
// categories. Non-destructive: old categories/services are deactivated
// (active: false), never deleted, so any existing ServiceRequest still
// resolves its serviceId/categoryId fine. More categories get added later,
// this is deliberately not meant to be the permanent final set.

const CATEGORIES: { key: string; label: string; keepExisting?: boolean }[] = [
  { key: 'HOME_APPLIANCES', label: 'Home Appliances' },
  { key: 'PEST_CONTROL', label: 'Pest Control', keepExisting: true }, // already exists with this exact key
  { key: 'HOME_CLEANING', label: 'Home Cleaning' },
  { key: 'BLISS_SALON', label: 'Bliss & Salon' },
];

interface ServiceDef {
  category: string;
  name: string;
  basePrice: number;
  visitingCharge: number;
  durationMinutes: number;
  description: string;
}

const SERVICES: ServiceDef[] = [
  // --- Home Appliances ---
  { category: 'HOME_APPLIANCES', name: 'AC Repair Services & Repair', basePrice: 499, visitingCharge: 99, durationMinutes: 90, description: 'Full diagnostic check, gas top-up, and cooling performance restoration by a certified AC technician.' },
  { category: 'HOME_APPLIANCES', name: 'Refrigerator Repair', basePrice: 449, visitingCharge: 99, durationMinutes: 60, description: 'Diagnosis and repair of cooling issues, unusual noise, or leakage for all major refrigerator brands.' },
  { category: 'HOME_APPLIANCES', name: 'Washing Machine Repair & Services', basePrice: 399, visitingCharge: 99, durationMinutes: 60, description: 'Fixes for drainage, spin cycle, and motor issues on both front-load and top-load washing machines.' },
  { category: 'HOME_APPLIANCES', name: 'LED TV Repair & Installation', basePrice: 399, visitingCharge: 99, durationMinutes: 60, description: 'Screen, display, and connectivity troubleshooting, plus wall-mount installation for LED/LCD TVs.' },
  { category: 'HOME_APPLIANCES', name: 'Microwave Oven Repair', basePrice: 349, visitingCharge: 99, durationMinutes: 45, description: 'Repairs for heating, turntable, and control panel issues on microwave and OTG ovens.' },
  { category: 'HOME_APPLIANCES', name: 'Geyser Repair & Services', basePrice: 349, visitingCharge: 99, durationMinutes: 60, description: 'Heating element, thermostat, and tank inspection to fix slow heating or water leakage issues.' },
  { category: 'HOME_APPLIANCES', name: 'Chimney Repair & Services', basePrice: 499, visitingCharge: 99, durationMinutes: 75, description: 'Degreasing, filter cleaning, and motor repair for better suction and less kitchen smoke.' },
  { category: 'HOME_APPLIANCES', name: 'RO Repair & Services', basePrice: 299, visitingCharge: 99, durationMinutes: 45, description: 'Filter replacement, tank cleaning, and full performance check for your water purifier.' },

  // --- Pest Control ---
  { category: 'PEST_CONTROL', name: 'Residential Pest Control', basePrice: 899, visitingCharge: 99, durationMinutes: 90, description: 'Whole-home pest treatment using safe-for-family sprays, covering common household pests.' },
  { category: 'PEST_CONTROL', name: 'Commercial Pest Control', basePrice: 1999, visitingCharge: 99, durationMinutes: 120, description: 'Pest treatment for offices, shops, and commercial spaces with minimal disruption to operations.' },
  { category: 'PEST_CONTROL', name: 'General Pest Control', basePrice: 799, visitingCharge: 99, durationMinutes: 90, description: 'Standard treatment for cockroaches, ants, and other common household pests.' },
  { category: 'PEST_CONTROL', name: 'Termite Control', basePrice: 1499, visitingCharge: 99, durationMinutes: 120, description: 'Anti-termite treatment to protect furniture, wood fittings, and your home\'s structure.' },
  { category: 'PEST_CONTROL', name: 'Bed Bug Treatment', basePrice: 999, visitingCharge: 99, durationMinutes: 90, description: 'Targeted treatment for bed bugs in mattresses, furniture, and cracks around the home.' },
  { category: 'PEST_CONTROL', name: 'Mosquito Control', basePrice: 699, visitingCharge: 99, durationMinutes: 60, description: 'Fogging and larvicide treatment to reduce mosquito breeding around your home.' },
  { category: 'PEST_CONTROL', name: 'Ant Control', basePrice: 599, visitingCharge: 99, durationMinutes: 60, description: 'Targeted gel and spray treatment to eliminate ant infestations at the source.' },
  { category: 'PEST_CONTROL', name: 'Rat Control', basePrice: 699, visitingCharge: 99, durationMinutes: 60, description: 'Safe trapping and baiting treatment to control rodent infestations.' },
  { category: 'PEST_CONTROL', name: 'Termite Inspection', basePrice: 399, visitingCharge: 99, durationMinutes: 45, description: 'A detailed inspection to check for termite activity and recommend the right treatment.' },

  // --- Home Cleaning ---
  { category: 'HOME_CLEANING', name: 'Quick Support-Cleaning', basePrice: 499, visitingCharge: 99, durationMinutes: 60, description: 'A quick general cleaning visit for light dusting, mopping, and tidying up.' },
  { category: 'HOME_CLEANING', name: 'Kitchen Cleaning', basePrice: 599, visitingCharge: 99, durationMinutes: 90, description: 'Deep cleaning of kitchen surfaces, cabinets, and fixtures including hard-to-reach corners.' },
  { category: 'HOME_CLEANING', name: 'Bathroom Cleaning', basePrice: 399, visitingCharge: 99, durationMinutes: 60, description: 'Deep cleaning and de-scaling of tiles, fittings, and fixtures for a sparkling bathroom.' },
  { category: 'HOME_CLEANING', name: 'Sofa Clean', basePrice: 799, visitingCharge: 99, durationMinutes: 75, description: 'Deep shampoo and vacuum cleaning for sofas to remove stains, dust, and odour.' },
  { category: 'HOME_CLEANING', name: 'Residential Cleaning', basePrice: 1999, visitingCharge: 99, durationMinutes: 180, description: 'Full-home deep cleaning covering every room, ideal for a seasonal or move-in clean.' },
  { category: 'HOME_CLEANING', name: 'Commercial Cleaning', basePrice: 2999, visitingCharge: 99, durationMinutes: 240, description: 'Deep cleaning service for offices and commercial spaces, scheduled around your working hours.' },

  // --- Bliss & Salon ---
  { category: 'BLISS_SALON', name: 'Haircut', basePrice: 299, visitingCharge: 99, durationMinutes: 45, description: 'Professional haircut and styling at home by a trained stylist.' },
  { category: 'BLISS_SALON', name: 'Hair Color', basePrice: 999, visitingCharge: 99, durationMinutes: 90, description: 'Full hair colouring service using quality products, done in the comfort of your home.' },
  { category: 'BLISS_SALON', name: 'Hair Highlight', basePrice: 1499, visitingCharge: 99, durationMinutes: 120, description: 'Professional hair highlighting for a natural, dimensional look.' },
  { category: 'BLISS_SALON', name: 'Hair Keratin Therapy', basePrice: 2999, visitingCharge: 99, durationMinutes: 150, description: 'Smoothening keratin treatment to reduce frizz and add long-lasting shine.' },
  { category: 'BLISS_SALON', name: 'Hair Botox', basePrice: 2499, visitingCharge: 99, durationMinutes: 120, description: 'Deep-conditioning hair botox treatment to repair damage and restore softness.' },
  { category: 'BLISS_SALON', name: 'Bliss Glow Facial', basePrice: 1299, visitingCharge: 99, durationMinutes: 60, description: 'A rejuvenating facial treatment to brighten and refresh your skin.' },
  { category: 'BLISS_SALON', name: 'Bliss Gold Facial', basePrice: 1999, visitingCharge: 99, durationMinutes: 75, description: 'A premium gold facial for deep nourishment and a radiant glow.' },
  { category: 'BLISS_SALON', name: 'Face Clean-Up', basePrice: 599, visitingCharge: 99, durationMinutes: 45, description: 'A quick refreshing face clean-up to remove impurities and refresh your skin.' },
  { category: 'BLISS_SALON', name: 'Bliss Party Makeup', basePrice: 1999, visitingCharge: 99, durationMinutes: 90, description: 'Party-ready makeup application by a trained makeup artist.' },
  { category: 'BLISS_SALON', name: 'Bliss HD Makeup', basePrice: 2999, visitingCharge: 99, durationMinutes: 120, description: 'HD makeup application for a flawless, camera-ready finish.' },
  { category: 'BLISS_SALON', name: 'Bliss Airbrush Makeup', basePrice: 3999, visitingCharge: 99, durationMinutes: 120, description: 'Long-lasting airbrush makeup application for a smooth, matte finish.' },
  { category: 'BLISS_SALON', name: 'Bliss Bridal Makeup', basePrice: 7999, visitingCharge: 99, durationMinutes: 180, description: 'Complete bridal makeup package for your big day, including trial consultation.' },
  { category: 'BLISS_SALON', name: 'Bliss Engagement Makeup', basePrice: 5999, visitingCharge: 99, durationMinutes: 150, description: 'Elegant engagement-day makeup tailored to your outfit and style.' },
  { category: 'BLISS_SALON', name: 'Bliss Reception Makeup', basePrice: 5999, visitingCharge: 99, durationMinutes: 150, description: 'Glamorous reception-day makeup for a picture-perfect look.' },
  { category: 'BLISS_SALON', name: 'Bliss Waxing', basePrice: 599, visitingCharge: 99, durationMinutes: 45, description: 'Full-body waxing service using quality wax for smooth, long-lasting results.' },
  { category: 'BLISS_SALON', name: 'Waxing Honey', basePrice: 699, visitingCharge: 99, durationMinutes: 45, description: 'Honey-based waxing service, gentle on sensitive skin.' },
  { category: 'BLISS_SALON', name: 'Waxing Rica', basePrice: 899, visitingCharge: 99, durationMinutes: 60, description: 'Premium Rica waxing service for smoother, longer-lasting results.' },
  { category: 'BLISS_SALON', name: 'Bleach', basePrice: 399, visitingCharge: 99, durationMinutes: 30, description: 'Skin-brightening bleach treatment for an even-toned glow.' },
  { category: 'BLISS_SALON', name: 'Manicures and pedicures', basePrice: 999, visitingCharge: 99, durationMinutes: 75, description: 'Combo manicure and pedicure package for complete hand and foot care.' },
  { category: 'BLISS_SALON', name: 'Manicures', basePrice: 499, visitingCharge: 99, durationMinutes: 45, description: 'Relaxing manicure service to clean, shape, and nourish your hands.' },
  { category: 'BLISS_SALON', name: 'Pedicures', basePrice: 599, visitingCharge: 99, durationMinutes: 45, description: 'Relaxing pedicure service to clean, shape, and nourish your feet.' },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  const uploader = await UserModel.findOne().sort({ createdAt: 1 });
  if (!uploader) throw new Error('No users found — cannot set FileModel.uploadedBy');

  console.log('[rebuild] upserting 4 top-level categories...');
  const categoryIds: Record<string, mongoose.Types.ObjectId> = {};
  for (const c of CATEGORIES) {
    const doc = await MasterModel.findOneAndUpdate(
      { masterType: 'SERVICE_CATEGORY', key: c.key },
      { label: c.label, active: true },
      { upsert: true, new: true }
    );
    categoryIds[c.key] = doc._id;
  }
  console.log('[rebuild] adding new category ids to every branch\'s coverage allowlist...');
  await BranchModel.updateMany({}, { $addToSet: { serviceCategoryIds: { $each: Object.values(categoryIds) } } });

  console.log('[rebuild] deactivating old demo categories (except PEST_CONTROL, now reused)...');
  const keptKeys = CATEGORIES.map((c) => c.key);
  await MasterModel.updateMany(
    { masterType: 'SERVICE_CATEGORY', key: { $nin: keptKeys } },
    { active: false }
  );

  console.log('[rebuild] deactivating old demo services...');
  const newNames = SERVICES.map((s) => s.name);
  await ServiceModel.updateMany({ name: { $nin: newNames } }, { active: false });

  console.log(`[rebuild] upserting ${SERVICES.length} services...`);
  let created = 0;
  let imaged = 0;
  for (const def of SERVICES) {
    const service = await ServiceModel.findOneAndUpdate(
      { name: def.name },
      {
        name: def.name,
        description: def.description,
        categoryId: categoryIds[def.category],
        pricing: { basePrice: def.basePrice, visitingCharge: def.visitingCharge, inspectionCharge: 0, emergencyCharge: 299 },
        expectedDurationMinutes: def.durationMinutes,
        slaMinutes: 1440,
        active: true,
      },
      { upsert: true, new: true }
    );
    created++;

    const existingImage = await FileModel.findOne({ entityType: 'SERVICE', entityId: service._id, category: 'CATALOG_IMAGE', deletedAt: { $exists: false } });
    if (!existingImage) {
      const slug = def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await FileModel.create({
        category: 'CATALOG_IMAGE',
        entityType: 'SERVICE',
        entityId: service._id,
        provider: 'CLOUDINARY',
        key: `seed/${slug}`,
        url: `https://picsum.photos/seed/${slug}/800/600`,
        mimeType: 'image/jpeg',
        sizeBytes: 0,
        uploadedBy: uploader._id,
      });
      imaged++;
    }
  }

  console.log(`[rebuild] done — 4 categories ready, ${created} services upserted, ${imaged} images added`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
