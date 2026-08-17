import '../src/config/env';
import mongoose from 'mongoose';
import { MasterModel } from '../src/modules/config/master.model';
import { ServiceModel } from '../src/modules/catalog/catalog.model';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  for (const t of ['COMPLAINT_TYPE', 'SYMPTOM', 'DEFECT', 'SOLUTION', 'PRODUCT_TYPE']) {
    const count = await MasterModel.countDocuments({ masterType: t });
    console.log(t, count);
  }

  const svc = await ServiceModel.findOne({ name: 'AC Repair Services & Repair' });
  console.log('AC service link counts:', {
    complaintTypeIds: svc?.complaintTypeIds.length,
    symptomIds: svc?.symptomIds.length,
    defectIds: svc?.defectIds.length,
    solutionTypeIds: svc?.solutionTypeIds.length,
    applicableProductTypeIds: svc?.applicableProductTypeIds.length,
  });

  const sample = await MasterModel.findOne({ masterType: 'SOLUTION', label: 'Gas filling' });
  console.log('sample SOLUTION doc:', sample?.toObject());

  const complaintDup = await MasterModel.find({ masterType: 'COMPLAINT_TYPE', label: /water leakage/i });
  console.log('water leakage complaint dedup check:', complaintDup.map((d) => d.label));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
