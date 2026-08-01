import connectDB from '../backend/src/config/db.js';
import { createApp } from '../backend/src/app.js';
import { ensureCollegeIndexSeeded } from '../backend/src/scripts/seedCollegeIndex.js';

let appInstance = null;

export default async function handler(req, res) {
  try {
    await connectDB();
    await ensureCollegeIndexSeeded();
  } catch (err) {
    console.error('Failed to initialize database connection or college index:', err);
  }

  if (!appInstance) {
    const { app } = createApp();
    appInstance = app;
  }

  return appInstance(req, res);
}
