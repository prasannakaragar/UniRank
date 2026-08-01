/**
 * scripts/debugMongo.js
 * Lists collections and document counts in MongoDB.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/unirank';

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`Connected to database: ${db.databaseName}`);
  const collections = await db.listCollections().toArray();
  console.log(`Collections in '${db.databaseName}':`, collections.map((c) => c.name));

  for (const coll of collections) {
    const count = await db.collection(coll.name).countDocuments();
    console.log(`Collection '${coll.name}': ${count} documents`);
  }
  await mongoose.disconnect();
} catch (err) {
  console.error('Debug mongo error:', err.message);
}
