import { connectDb, disconnectDb } from '../src/lib/db';
import { CustomerModel } from '../src/modules/customers/customers.model';
import { ServiceModel } from '../src/modules/catalog/catalog.model';
import { Types } from 'mongoose';

async function seedData() {
  await connectDb();
  
  // Create a customer
  const customer = await CustomerModel.create({
    customerType: 'INDIVIDUAL',
    name: 'Test Customer',
    email: 'test@example.com',
    contacts: [{ mobile: '1234567890', isPrimary: true }],
    addresses: [{
      line1: '123 Main St',
      city: 'Delhi',
      state: 'Delhi',
      pinCode: '110001',
      country: 'India',
      isDefault: true
    }]
  });
  
  // Create a service
  const service = await ServiceModel.create({
    name: 'AC Repair Test',
    categoryId: new Types.ObjectId(),
    active: true,
  });

  console.log(`Created Customer: ${customer._id}`);
  console.log(`Created Service: ${service._id}`);
  
  await disconnectDb();
}

seedData().catch(console.error);
