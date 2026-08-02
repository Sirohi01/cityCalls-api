import { connectDb, disconnectDb } from './src/lib/db';
import { UserModel } from './src/modules/users/users.model';

async function main() {
  await connectDb();
  const users = await UserModel.find({ role: { $regex: /VENDOR/i } });
  console.log('Vendors:', users);
  await disconnectDb();
}
main();
