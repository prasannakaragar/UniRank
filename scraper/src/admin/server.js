/**
 * admin/server.js
 *
 * Express server for the admin review dashboard.
 * Runs on ADMIN_PORT (default 5001), separate from the main API (5000).
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import adminRoutes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let adminServer = null;

export async function startAdminServer() {
  const app = express();
  app.use(express.json());

  // Serve the dashboard UI
  app.use(express.static(path.join(__dirname, 'public')));

  // Mount API routes
  app.use('/admin', adminRoutes);

  // Fallback: serve dashboard for any non-API route (SPA-style)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/admin')) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });

  return new Promise((resolve, reject) => {
    adminServer = app.listen(config.adminPort, () => {
      console.log(`[Admin] Dashboard running at http://localhost:${config.adminPort}`);
      resolve(adminServer);
    });
    adminServer.on('error', reject);
  });
}

export async function stopAdminServer() {
  if (adminServer) {
    await new Promise((resolve) => adminServer.close(resolve));
    adminServer = null;
  }
}
