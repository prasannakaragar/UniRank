/**
 * db/connection.js
 *
 * Mongoose connection for the scraper service.
 * Connects to the same MongoDB as the main backend (same MONGODB_URI).
 * The scraper is a separate Node process but shares the database.
 */

import mongoose from 'mongoose';
import { config } from '../config/index.js';

let connected = false;

export async function connectDB() {
  if (connected) return;

  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    connected = true;
    console.log('[DB] Connected to MongoDB:', config.mongoUri.replace(/\/\/[^@]+@/, '//***@'));
  } catch (err) {
    console.error('[DB] MongoDB connection failed:', err.message);
    throw err;
  }
}

export async function disconnectDB() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
  console.log('[DB] Disconnected from MongoDB');
}
