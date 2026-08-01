/**
 * scripts/resetDb.js
 * Drops the entire MongoDB database.
 * Usage: node src/scripts/resetDb.js
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import mongoose from 'mongoose';

dotenv.config();

async function resetDb() {
  await connectDB();
  console.log('Dropping database...');
  await mongoose.connection.db.dropDatabase();
  console.log('Database reset successfully.');
  await mongoose.disconnect();
}

resetDb().catch((err) => {
  console.error('Reset DB error:', err);
  process.exit(1);
});
