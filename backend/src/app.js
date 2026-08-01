/**
 * app.js
 * Express application factory, middleware, static files, and route registration.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';
import { globalLimiter } from './middleware/rateLimiter.js';

// Import routes
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import chatsRoutes from './routes/chats.js';
import adminRoutes from './routes/admin.js';
import hackathonsRoutes from './routes/hackathons.js';
import leaderboardRoutes from './routes/leaderboard.js';
import announcementsRoutes from './routes/announcements.js';
import teamsRoutes from './routes/teams.js';
import uploadsRoutes from './routes/uploads.js';
import discoveryRoutes from './routes/discovery.js';

dotenv.config();

export function createApp() {
  const app = express();

  // Trust reverse proxies (Render, Railway, Nginx)
  app.set('trust proxy', 1);

  // Parse CORS origins
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://uni-rank-chi.vercel.app',
    'https://uni-rank-yfuc.vercel.app',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
    ...(process.env.FRONTEND_URL_2 ? [process.env.FRONTEND_URL_2.trim()] : []),
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Global rate limiter
  app.use(globalLimiter);

  // Serve static files from static/uploads (or /tmp/uploads in serverless)
  const uploadsPath = process.env.VERCEL
    ? path.join(os.tmpdir(), 'uploads')
    : path.resolve('static/uploads');

  try {
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }
  } catch (err) {
    console.warn('[APP] Could not create static uploads directory:', err.message);
  }
  app.use('/api/static/uploads', express.static(uploadsPath));
  app.use('/static/uploads', express.static(uploadsPath));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api', (_req, res) => {
    res.send('UniRank Express API is running');
  });

  // Mount API routes under /api
  app.use('/api', authRoutes);
  app.use('/api', profileRoutes);
  app.use('/api', chatsRoutes);
  app.use('/api', adminRoutes);
  app.use('/api', hackathonsRoutes);
  app.use('/api', leaderboardRoutes);
  app.use('/api', announcementsRoutes);
  app.use('/api', teamsRoutes);
  app.use('/api', uploadsRoutes);
  app.use('/api', discoveryRoutes);

  // Serve compiled React frontend if present
  const frontendDistPath = path.resolve('frontend/dist');
  const altFrontendDistPath = path.resolve('../frontend/dist');
  const distPath = fs.existsSync(frontendDistPath)
    ? frontendDistPath
    : (fs.existsSync(altFrontendDistPath) ? altFrontendDistPath : null);

  if (distPath) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Global error handler
  app.use((err, _req, res, _next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app, allowedOrigins };
}
