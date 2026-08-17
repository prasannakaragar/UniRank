/**
 * server.js
 * Main entry point: connects to DB, creates HTTP server + Socket.IO, starts listening.
 */

import http from 'http';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { createApp } from './app.js';
import { initSocket } from './socket.js';
import { ensureCollegeIndexSeeded } from './scripts/seedCollegeIndex.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '5000', 10);

async function startServer() {
  await connectDB();
  await ensureCollegeIndexSeeded();

  const { app, allowedOrigins } = createApp();
  const server = http.createServer(app);

  initSocket(server, allowedOrigins);

  // Handle server errors gracefully (e.g. EADDRINUSE port conflicts)
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[SERVER] Port ${PORT} is in use. Auto-clearing conflicting process...`);
      try {
        execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true`);
        console.log(`[SERVER] Conflicting process cleared. Retrying port ${PORT} in 500ms...`);
        setTimeout(() => {
          server.listen(PORT, '0.0.0.0');
        }, 500);
      } catch (killErr) {
        console.error(`[SERVER] Failed to auto-clear port ${PORT}:`, killErr.message);
        process.exit(1);
      }
    } else {
      console.error('[SERVER] HTTP Server Error:', err);
      process.exit(1);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`==================================================`);
    console.log(`  UniRank Express Server running on port ${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Healthcheck: http://0.0.0.0:${PORT}/api/health`);
    console.log(`==================================================`);


  });

  // Graceful shutdown handler for nodemon (SIGUSR2) and process termination (SIGINT, SIGTERM)
  const handleShutdown = (signal) => {
    console.log(`\n[SERVER] Received ${signal}. Closing server cleanly...`);
    server.close(async () => {
      console.log('[SERVER] HTTP Server closed.');
      try {
        await mongoose.disconnect();
        console.log('[SERVER] MongoDB disconnected.');
      } catch {
        // ignore
      }
      if (signal === 'SIGUSR2') {
        process.kill(process.pid, 'SIGUSR2');
      } else {
        process.exit(0);
      }
    });

    // Timeout fallback in case server.close hangs
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.once('SIGUSR2', () => handleShutdown('SIGUSR2'));
  process.once('SIGINT', () => handleShutdown('SIGINT'));
  process.once('SIGTERM', () => handleShutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
