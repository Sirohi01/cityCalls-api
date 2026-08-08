import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { UserModel } from '../src/modules/users/users.model';

async function main() {
  await mongoose.connect(env.mongodbUri);
  const r1 = await UserModel.deleteMany({ mobile: '9700000021' });
  console.log('Deleted', r1.deletedCount, 'CS exec test users');
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
