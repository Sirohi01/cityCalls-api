import '../src/config/env';
import mongoose from 'mongoose';
import { MasterModel, MasterType } from '../src/modules/config/master.model';
import { ServiceModel } from '../src/modules/catalog/catalog.model';

interface Row {
  service: string;
  complaint: string;
  symptom: string;
  defect: string;
  repair: string;
  repairCategory: string;
}

const ROWS: Row[] = [
  // --- Pest Control ---
  { service: 'Ant Control', complaint: 'Ants in Kitchen', symptom: 'Ant Trails Visible', defect: 'Ant Colony Near Foundation', repair: 'Ant Gel Baiting', repairCategory: 'Treatment' },
  { service: 'Ant Control', complaint: 'Ants Returning After Spray', symptom: 'Recurring Ant Activity', defect: 'Entry Points Not Sealed', repair: 'Follow-up Spray Treatment', repairCategory: 'Follow-up' },
  { service: 'Bed Bug Treatment', complaint: 'Bed Bug Bites', symptom: 'Bite Marks on Skin', defect: 'Bed Bugs in Mattress Seams', repair: 'Steam & Chemical Treatment', repairCategory: 'Treatment' },
  { service: 'Bed Bug Treatment', complaint: 'Bugs Still Active at Night', symptom: 'Live Bed Bugs Found', defect: 'Eggs Hidden in Crevices', repair: 'Follow-up Treatment After 15 Days', repairCategory: 'Follow-up' },
  { service: 'Commercial Pest Control', complaint: 'Pest Complaints from Staff/Customers', symptom: 'Multiple Pest Species Sighted', defect: 'Poor Sanitation Practices', repair: 'Integrated Pest Management Plan', repairCategory: 'Treatment' },
  { service: 'Commercial Pest Control', complaint: 'Repeat Infestation', symptom: 'Pests Entering from Storage Area', defect: 'Untreated Entry Points', repair: 'Perimeter Barrier Treatment', repairCategory: 'Prevention' },
  { service: 'General Pest Control', complaint: 'Mixed Pest Problem', symptom: 'Cockroaches and Ants Seen', defect: 'Food Source Accessible', repair: 'General Spray Treatment', repairCategory: 'Treatment' },
  { service: 'General Pest Control', complaint: 'Musty Smell in Kitchen', symptom: 'Droppings Found in Cabinets', defect: 'Moisture Build-up', repair: 'Sanitization & Spray', repairCategory: 'Treatment' },
  { service: 'Mosquito Control', complaint: 'Mosquito Bites at Home', symptom: 'Mosquitoes Increasing in Evening', defect: 'Stagnant Water Nearby', repair: 'Fogging Treatment', repairCategory: 'Treatment' },
  { service: 'Mosquito Control', complaint: 'Dengue/Malaria Concern', symptom: 'Larvae Found in Water Storage', defect: 'Breeding Site Untreated', repair: 'Larvicide Application', repairCategory: 'Treatment' },
  { service: 'Rat Control', complaint: 'Rats Seen at Night', symptom: 'Droppings and Gnaw Marks', defect: 'Food Storage Accessible', repair: 'Rodent Baiting & Trapping', repairCategory: 'Treatment' },
  { service: 'Rat Control', complaint: 'Noise in Ceiling/Walls', symptom: 'Rat Movement Sounds', defect: 'Entry Gap in Wall/Roof', repair: 'Sealing Entry Points', repairCategory: 'Prevention' },
  { service: 'Residential Pest Control', complaint: 'General Pest Nuisance at Home', symptom: 'Cockroaches in Kitchen', defect: 'Unsanitary Conditions', repair: 'Full-Home Spray Treatment', repairCategory: 'Treatment' },
  { service: 'Residential Pest Control', complaint: 'Pests Returning Every Few Months', symptom: 'Seasonal Pest Increase', defect: 'No AMC in Place', repair: 'Quarterly Treatment Plan', repairCategory: 'Prevention' },
  { service: 'Termite Control', complaint: 'Wooden Furniture Damage', symptom: 'Hollow Sound in Wood', defect: 'Termite Mud Tubes Found', repair: 'Termite Barrier Treatment', repairCategory: 'Treatment' },
  { service: 'Termite Control', complaint: 'Termites Near Foundation', symptom: 'Mud Tunnels on Walls', defect: 'Untreated Soil Barrier', repair: 'Soil Injection Treatment', repairCategory: 'Treatment' },
  { service: 'Termite Inspection', complaint: 'Suspecting Termite Activity', symptom: 'Wood Sounds Hollow', defect: 'Old Termite Damage Visible', repair: 'Detailed Inspection Report', repairCategory: 'Inspection' },
  { service: 'Termite Inspection', complaint: 'Considering AMC', symptom: 'No Active Infestation Found', defect: 'Preventive Check Needed', repair: 'Preventive Treatment Recommendation', repairCategory: 'Inspection' },

  // --- Home Cleaning ---
  { service: 'Bathroom Cleaning', complaint: 'Tile Stains Not Removed', symptom: 'Grout Discoloration', defect: 'Hard Water Scaling', repair: 'Descaling & Scrub Treatment', repairCategory: 'Cleaning' },
  { service: 'Bathroom Cleaning', complaint: 'Bad Odour in Bathroom', symptom: 'Drain Smell', defect: 'Mould in Corners', repair: 'Disinfection & Mould Removal', repairCategory: 'Cleaning' },
  { service: 'Commercial Cleaning', complaint: 'Office Looks Untidy', symptom: 'Dust on Surfaces & Vents', defect: 'Infrequent Cleaning Schedule', repair: 'Scheduled Deep Cleaning', repairCategory: 'Cleaning' },
  { service: 'Commercial Cleaning', complaint: 'Washroom Hygiene Complaints', symptom: 'Stains in Washroom', defect: 'High Footfall Wear', repair: 'Sanitization Service', repairCategory: 'Cleaning' },
  { service: 'Kitchen Cleaning', complaint: 'Grease on Chimney/Walls', symptom: 'Sticky Surfaces', defect: 'Grease Build-up', repair: 'Degreasing Treatment', repairCategory: 'Cleaning' },
  { service: 'Kitchen Cleaning', complaint: 'Cabinet Stains', symptom: 'Stained Cabinet Interiors', defect: 'Spillage Not Cleaned', repair: 'Deep Cabinet Cleaning', repairCategory: 'Cleaning' },
  { service: 'Quick Support-Cleaning', complaint: 'General Untidiness', symptom: 'Dust on Furniture', defect: 'Infrequent Dusting', repair: 'Quick Dusting & Mopping', repairCategory: 'Cleaning' },
  { service: 'Quick Support-Cleaning', complaint: 'Floor Looks Dull', symptom: 'Dull Floor Surface', defect: 'Accumulated Dirt', repair: 'Mopping & Surface Wipe', repairCategory: 'Cleaning' },
  { service: 'Residential Cleaning', complaint: 'Whole House Needs Deep Clean', symptom: 'Dust in Every Room', defect: 'Seasonal Neglect', repair: 'Full-Home Deep Cleaning', repairCategory: 'Cleaning' },
  { service: 'Residential Cleaning', complaint: 'Move-in/Move-out Cleaning Needed', symptom: 'Previous Occupant Dirt', defect: 'Unclean Handover', repair: 'Move-in Deep Clean Package', repairCategory: 'Cleaning' },
  { service: 'Sofa Clean', complaint: 'Sofa Stains', symptom: 'Visible Stains on Fabric', defect: 'Spillage Absorbed in Fabric', repair: 'Shampoo & Stain Removal', repairCategory: 'Cleaning' },
  { service: 'Sofa Clean', complaint: 'Sofa Smells Bad', symptom: 'Musty Odour from Fabric', defect: 'Moisture Trapped in Cushion', repair: 'Steam Clean & Deodorize', repairCategory: 'Cleaning' },

  // --- Bliss & Salon ---
  { service: 'Haircut', complaint: 'Hair Looks Uneven', symptom: 'Split Ends', defect: 'Overgrown/Unstyled Hair', repair: 'Trim & Style', repairCategory: 'Styling' },
  { service: 'Hair Color', complaint: 'Want New Hair Colour', symptom: 'Grey Hair Coverage Needed', defect: 'Faded Previous Colour', repair: 'Hair Colouring Service', repairCategory: 'Styling' },
  { service: 'Hair Highlight', complaint: 'Want Dimension in Hair', symptom: 'Flat/Single-tone Hair', defect: 'No Layered Colour', repair: 'Highlighting Service', repairCategory: 'Styling' },
  { service: 'Hair Keratin Therapy', complaint: 'Frizzy Unmanageable Hair', symptom: 'Frizz & Dryness', defect: 'Chemical Damage from Styling', repair: 'Keratin Smoothening Treatment', repairCategory: 'Treatment' },
  { service: 'Hair Botox', complaint: 'Damaged Dull Hair', symptom: 'Rough Hair Texture', defect: 'Heat Styling Damage', repair: 'Hair Botox Treatment', repairCategory: 'Treatment' },
  { service: 'Bliss Glow Facial', complaint: 'Dull Skin', symptom: 'Lack of Skin Glow', defect: 'Dead Skin Build-up', repair: 'Glow Facial Treatment', repairCategory: 'Treatment' },
  { service: 'Bliss Gold Facial', complaint: 'Skin Looks Tired/Ageing', symptom: 'Fine Lines & Dullness', defect: 'Reduced Skin Elasticity', repair: 'Gold Facial Treatment', repairCategory: 'Treatment' },
  { service: 'Face Clean-Up', complaint: 'Clogged Pores', symptom: 'Blackheads & Impurities', defect: 'Dirt & Oil Build-up', repair: 'Face Clean-Up Service', repairCategory: 'Treatment' },
  { service: 'Bliss Party Makeup', complaint: 'Event Makeup Needed', symptom: 'Wants Party-ready Look', defect: 'No Time for Salon Visit', repair: 'Party Makeup Application', repairCategory: 'Makeup' },
  { service: 'Bliss HD Makeup', complaint: 'Wants Camera-ready Look', symptom: 'Photography/Event Coming Up', defect: 'Regular Makeup Not Long-lasting', repair: 'HD Makeup Application', repairCategory: 'Makeup' },
  { service: 'Bliss Airbrush Makeup', complaint: 'Wants Flawless Matte Finish', symptom: "Makeup Doesn't Last Long", defect: 'Oily Skin Makeup Fading', repair: 'Airbrush Makeup Application', repairCategory: 'Makeup' },
  { service: 'Bliss Bridal Makeup', complaint: 'Wedding Makeup Needed', symptom: 'Wants Long-lasting Bridal Look', defect: 'No Trial Done Yet', repair: 'Bridal Makeup Package', repairCategory: 'Makeup' },
  { service: 'Bliss Engagement Makeup', complaint: 'Engagement Look Needed', symptom: 'Wants Elegant Makeup', defect: 'Outfit-matching Makeup Needed', repair: 'Engagement Makeup Service', repairCategory: 'Makeup' },
  { service: 'Bliss Reception Makeup', complaint: 'Reception Look Needed', symptom: 'Wants Glamorous Look', defect: 'Different Look from Wedding Day', repair: 'Reception Makeup Service', repairCategory: 'Makeup' },
  { service: 'Bliss Waxing', complaint: 'Unwanted Body Hair', symptom: 'Hair Regrowth', defect: 'Regular Hair Growth Cycle', repair: 'Full-Body Waxing', repairCategory: 'Grooming' },
  { service: 'Waxing Honey', complaint: 'Sensitive Skin Waxing Needed', symptom: 'Skin Irritation with Regular Wax', defect: 'Harsh Wax Reaction', repair: 'Honey Wax Treatment', repairCategory: 'Grooming' },
  { service: 'Waxing Rica', complaint: 'Wants Smoother Longer-lasting Results', symptom: 'Quick Hair Regrowth', defect: 'Coarse Hair Growth', repair: 'Rica Wax Treatment', repairCategory: 'Grooming' },
  { service: 'Bleach', complaint: 'Uneven Skin Tone', symptom: 'Tan & Pigmentation', defect: 'Sun Exposure Tanning', repair: 'Bleach Treatment', repairCategory: 'Treatment' },
  { service: 'Manicures and pedicures', complaint: 'Rough Hands and Feet', symptom: 'Dry Cuticles & Nails', defect: 'Lack of Regular Care', repair: 'Combo Mani-Pedi Service', repairCategory: 'Grooming' },
  { service: 'Manicures', complaint: 'Rough/Dry Hands', symptom: 'Damaged Cuticles', defect: 'Lack of Hand Care', repair: 'Manicure Service', repairCategory: 'Grooming' },
  { service: 'Pedicures', complaint: 'Cracked Heels', symptom: 'Rough Feet Skin', defect: 'Dead Skin Build-up on Feet', repair: 'Pedicure Service', repairCategory: 'Grooming' },
];

function slugKey(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

class MasterCache {
  private byType = new Map<MasterType, Map<string, mongoose.Types.ObjectId>>();
  private keysInUse = new Map<MasterType, Set<string>>();
  stats = { reused: 0, created: 0 };

  async preload(masterType: MasterType) {
    const existing = await MasterModel.find({ masterType });
    const labelMap = new Map<string, mongoose.Types.ObjectId>();
    const keys = new Set<string>();
    for (const doc of existing) {
      labelMap.set(doc.label.trim().toLowerCase(), doc._id);
      keys.add(doc.key);
    }
    this.byType.set(masterType, labelMap);
    this.keysInUse.set(masterType, keys);
  }

  async upsert(masterType: MasterType, label: string, meta?: Record<string, unknown>): Promise<mongoose.Types.ObjectId> {
    const norm = label.trim().toLowerCase();
    const labelMap = this.byType.get(masterType)!;
    const existingId = labelMap.get(norm);
    if (existingId) {
      this.stats.reused++;
      if (meta) {
        await MasterModel.updateOne({ _id: existingId, 'meta.repairCategory': { $exists: false } }, { $set: meta });
      }
      return existingId;
    }
    const keys = this.keysInUse.get(masterType)!;
    let key = slugKey(label);
    let suffix = 2;
    while (keys.has(key)) {
      key = `${slugKey(label)}_${suffix++}`;
    }
    keys.add(key);
    const doc = await MasterModel.create({ masterType, key, label: label.trim(), meta: meta ?? {}, active: true });
    labelMap.set(norm, doc._id);
    this.stats.created++;
    return doc._id;
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  const cache = new MasterCache();
  await Promise.all([
    cache.preload('COMPLAINT_TYPE'),
    cache.preload('SYMPTOM'),
    cache.preload('DEFECT'),
    cache.preload('SOLUTION'),
  ]);

  console.log(`[import] processing ${ROWS.length} rows for Pest Control / Home Cleaning / Bliss & Salon...`);
  const serviceLinks = new Map<string, { complaintTypeIds: Set<string>; symptomIds: Set<string>; defectIds: Set<string>; solutionTypeIds: Set<string> }>();

  function linksFor(serviceName: string) {
    let entry = serviceLinks.get(serviceName);
    if (!entry) {
      entry = { complaintTypeIds: new Set(), symptomIds: new Set(), defectIds: new Set(), solutionTypeIds: new Set() };
      serviceLinks.set(serviceName, entry);
    }
    return entry;
  }

  for (const row of ROWS) {
    const complaintId = await cache.upsert('COMPLAINT_TYPE', row.complaint);
    const symptomId = await cache.upsert('SYMPTOM', row.symptom);
    const defectId = await cache.upsert('DEFECT', row.defect);
    const solutionId = await cache.upsert('SOLUTION', row.repair, { repairCategory: row.repairCategory });

    const links = linksFor(row.service);
    links.complaintTypeIds.add(complaintId.toString());
    links.symptomIds.add(symptomId.toString());
    links.defectIds.add(defectId.toString());
    links.solutionTypeIds.add(solutionId.toString());
  }

  console.log(`[import] linking ${serviceLinks.size} services...`);
  let servicesLinked = 0;
  let servicesMissing = 0;
  for (const [serviceName, links] of serviceLinks) {
    const res = await ServiceModel.updateOne(
      { name: serviceName },
      {
        $addToSet: {
          complaintTypeIds: { $each: [...links.complaintTypeIds] },
          symptomIds: { $each: [...links.symptomIds] },
          defectIds: { $each: [...links.defectIds] },
          solutionTypeIds: { $each: [...links.solutionTypeIds] },
        },
      }
    );
    if (res.matchedCount > 0) servicesLinked++;
    else {
      servicesMissing++;
      console.warn(`[import] Service "${serviceName}" not found`);
    }
  }

  console.log(`[import] done — Masters: ${cache.stats.created} created, ${cache.stats.reused} reused. Services linked: ${servicesLinked}, missing: ${servicesMissing}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
