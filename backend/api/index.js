import connectDB from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { ensureCollegeIndexSeeded } from '../src/scripts/seedCollegeIndex.js';

let appInstance = null;
let isIndexSeeded = false;

export default async function handler(req, res) {
  try {
    await connectDB();
    if (!isIndexSeeded) {
      isIndexSeeded = true;
      ensureCollegeIndexSeeded().catch((err) =>
        console.error('Background college index seed error:', err)
      );
    }
  } catch (err) {
    console.error('Failed to initialize database connection:', err);
  }

  if (!appInstance) {
    const { app } = createApp();
    appInstance = app;
  }

  return appInstance(req, res);
}
