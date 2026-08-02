import { connectDb, disconnectDb } from './src/lib/db';
import { UserModel } from './src/modules/users/users.model';

async function main() {
  await connectDb();
  const users = await UserModel.find({}, { name: 1, mobile: 1, role: 1 });
  console.log('All Users:', users);
  await disconnectDb();
}
main();
