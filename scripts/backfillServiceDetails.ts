import '../src/config/env';
import mongoose from 'mongoose';
import { ServiceModel } from '../src/modules/catalog/catalog.model';
import { FileModel } from '../src/modules/files/files.model';
import { UserModel } from '../src/modules/users/users.model';

// Additive backfill for services created before description/expectedDurationMinutes
// were seeded (or before the CATALOG_IMAGE seeding existed) — deliberately does
// NOT touch customers/users/branches/service-requests, unlike
// seedSampleOperationalData.ts's full reseed (which requires wiping all
// customers first via its own guard). Safe to run against a DB that already
// has real, in-progress data.
const DETAILS: Record<string, { description: string; expectedDurationMinutes: number }> = {
  'AC Repair & Gas Refilling': { description: 'Full diagnostic check, gas top-up, and cooling performance restoration by a certified AC technician — done at your home.', expectedDurationMinutes: 90 },
  'AC Installation': { description: 'Professional split/window AC installation including mounting, piping, and a post-install cooling check.', expectedDurationMinutes: 120 },
  'Refrigerator Repair': { description: 'Diagnosis and repair of cooling issues, unusual noise, or leakage for all major refrigerator brands.', expectedDurationMinutes: 60 },
  'Washing Machine Repair': { description: 'Fixes for drainage, spin cycle, and motor issues on both front-load and top-load washing machines.', expectedDurationMinutes: 60 },
  'Water Purifier Service': { description: 'Filter replacement, tank cleaning, and full performance check to keep your purifier running safely.', expectedDurationMinutes: 45 },
  'Chimney Deep Cleaning': { description: 'Degreasing and deep cleaning of chimney filters and motor for better suction and less kitchen smoke.', expectedDurationMinutes: 75 },
  'Geyser Repair': { description: 'Heating element, thermostat, and tank inspection to fix slow heating or water leakage issues.', expectedDurationMinutes: 60 },
  'Electrical Wiring Fix': { description: 'Safe diagnosis and repair of switchboards, short circuits, and faulty home wiring by a licensed electrician.', expectedDurationMinutes: 45 },
  'Tap & Pipe Repair': { description: 'Leak fixes, tap replacement, and pipe repair work for kitchens and bathrooms.', expectedDurationMinutes: 45 },
  'Modular Furniture Repair': { description: 'Hinge, drawer, and modular fitting repairs to restore wardrobes, cabinets, and furniture.', expectedDurationMinutes: 60 },
  'Full Home Painting': { description: 'End-to-end interior painting service including surface prep, putty work, and two coats of your chosen finish.', expectedDurationMinutes: 480 },
  'General Pest Control': { description: 'Whole-home pest treatment for cockroaches, ants, and common household pests using safe-for-family sprays.', expectedDurationMinutes: 90 },
  'Home Deep Cleaning': { description: 'Detailed deep cleaning of kitchens, bathrooms, and living spaces — including hard-to-reach corners and fixtures.', expectedDurationMinutes: 180 },
  'Sofa Cleaning': { description: 'Deep shampoo and vacuum cleaning for sofas and carpets to remove stains, dust, and odour.', expectedDurationMinutes: 90 },
  "Women's Salon at Home": { description: 'Professional salon services — haircut, styling, waxing, and more — delivered at your doorstep by a trained beautician.', expectedDurationMinutes: 60 },
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  const uploader = await UserModel.findOne().sort({ createdAt: 1 });
  if (!uploader) throw new Error('No users found in DB — cannot set FileModel.uploadedBy');

  const services = await ServiceModel.find();
  let updated = 0;
  let imaged = 0;
  let skipped = 0;

  for (const service of services) {
    const details = DETAILS[service.name];
    if (!details) {
      console.log(`[backfill] skipping "${service.name}" — not in curated catalog list`);
      skipped++;
      continue;
    }

    let changed = false;
    if (!service.description) {
      service.description = details.description;
      changed = true;
    }
    if (!service.expectedDurationMinutes || service.expectedDurationMinutes === 60) {
      service.expectedDurationMinutes = details.expectedDurationMinutes;
      changed = true;
    }
    if (changed) {
      await service.save();
      updated++;
      console.log(`[backfill] updated details for "${service.name}"`);
    }

    const existingImage = await FileModel.findOne({ entityType: 'SERVICE', entityId: service._id, category: 'CATALOG_IMAGE', deletedAt: { $exists: false } });
    if (!existingImage) {
      const imageSlug = service.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await FileModel.create({
        category: 'CATALOG_IMAGE',
        entityType: 'SERVICE',
        entityId: service._id,
        provider: 'CLOUDINARY',
        key: `seed/${imageSlug}`,
        url: `https://picsum.photos/seed/${imageSlug}/800/600`,
        mimeType: 'image/jpeg',
        sizeBytes: 0,
        uploadedBy: uploader._id,
      });
      imaged++;
      console.log(`[backfill] added catalog image for "${service.name}"`);
    }
  }

  console.log(`[backfill] done — ${updated} services updated, ${imaged} images added, ${skipped} skipped (not in curated list)`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
