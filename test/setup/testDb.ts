import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Real (in-memory) MongoDB for integration tests — per docs/19-testing-strategy.md
// §1 "mongodb-memory-server or a disposable test DB." Unlike the mocked unit
// tests in src/lib/*.test.ts, these exercise actual Mongoose schema validation,
// index behavior, and Express request/response wiring end-to-end — the class
// of bug a pure typecheck/lint/mocked-unit-test pass cannot catch (see the
// Express 5 req.query getter-only bug found via manual `npm start` testing,
// fixed in validate.middleware.ts).
let mongod: MongoMemoryServer | undefined;

export async function connectTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod?.stop();
}

export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}
