/**
 * middleware/rateLimiter.js
 * Simple in-memory rate limiter (sliding window) + express-rate-limit for global defaults.
 */

import rateLimit from 'express-rate-limit';

// ── In-memory sliding window (port of utils/rate_limiter.py) ─────────────

const _requestLog = {};

/**
 * Express middleware factory: limit requests per IP per route.
 * Default: 5 requests per 5 minutes.
 */
export function rateLimitSlidingWindow(maxRequests = 5, windowSeconds = 300) {
  return (req, res, next) => {
    // Get real IP if behind a proxy
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? forwarded.split(',')[0].trim()
      : req.ip || 'unknown';

    const key = `${ip}:${req.route?.path || req.path}`;
    const now = Date.now() / 1000;

    if (!_requestLog[key]) _requestLog[key] = [];

    // Prune old entries
    _requestLog[key] = _requestLog[key].filter(
      (ts) => now - ts < windowSeconds
    );

    if (_requestLog[key].length >= maxRequests) {
      return res
        .status(429)
        .json({ error: 'Too many requests. Please try again later.' });
    }

    _requestLog[key].push(now);
    next();
  };
}

// ── express-rate-limit for global defaults ───────────────────────────────

export const globalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' },
});

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: 'Too many login attempts. Please try again later.' },
});

export const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

export const resendOtpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  message: { error: 'Too many OTP resend attempts. Please try again later.' },
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  message: { error: 'Too many password reset requests. Please try again later.' },
});

