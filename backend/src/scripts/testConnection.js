/**
 * scripts/testConnection.js
 * Tests MongoDB connection.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/unirank';

try {
  await mongoose.connect(uri);
  console.log('[OK] MongoDB Connected Successfully');
  await mongoose.disconnect();
} catch (err) {
  console.error('[ERROR] MongoDB Connection Failed:', err.message);
}
