/**
 * index.ts
 *
 * Scraper standalone Express server entry point.
 * Runs on SCRAPER_PORT (default 5002), connects to MongoDB, mounts API routes.
 * Includes graceful EADDRINUSE handling to auto-clear stale processes on restart.
 */

import http from 'http';
import { execSync } from 'child_process';
import express from 'express';
import mongoose from 'mongoose';
import { config } from './config/index.js';
import scraperRoutes from './routes/scraperRoutes.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('SERVER');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount scraper API routes under /api
app.use('/api', scraperRoutes);

// Healthcheck endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'UniRank Data Acquisition System',
    timestamp: new Date().toISOString(),
  });
});

async function start() {
  try {
    log.info('Connecting to MongoDB...');
    await mongoose.connect(config.mongoUri);
    log.success(`MongoDB connected — ${mongoose.connection.host}`);

    const server = http.createServer(app);
    const PORT = config.scraperPort;

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        log.warn(`Port ${PORT} is in use. Auto-clearing conflicting process...`);
        try {
          execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true`);
          log.info(`Conflicting process cleared. Retrying port ${PORT} in 500ms...`);
          setTimeout(() => {
            server.listen(PORT, '0.0.0.0');
          }, 500);
        } catch (killErr: any) {
          log.error(`Failed to auto-clear port ${PORT}: ${killErr.message}`);
          process.exit(1);
        }
      } else {
        log.error(`HTTP Server Error: ${err.message}`);
        process.exit(1);
      }
    });

    server.listen(PORT, '0.0.0.0', () => {
      log.info('==================================================');
      log.info(`  UniRank Scraper Service running on port ${PORT}`);
      log.info(`  Healthcheck: http://localhost:${PORT}/health`);
      log.info('==================================================');
    });
  } catch (err) {
    log.error(`Failed to start scraper service: ${(err as Error).message}`);
    process.exit(1);
  }
}

start();
