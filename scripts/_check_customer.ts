import '../src/config/env';
import mongoose from 'mongoose';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const db = mongoose.connection.db!;
  const customer = await db.collection('customers').findOne({ _id: new mongoose.Types.ObjectId('6a5ba5404ed92b8337b6ed95') });
  console.log(JSON.stringify(customer, null, 2));
  process.exit(0);
}
main();
