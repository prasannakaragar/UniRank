/**
 * routes/auth.js — UniRank
 * Production-grade authentication: registration, OTP verification, and login.
 */

import { Router } from 'express';
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from '../utils/password.js';
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  sendOtpEmail,
} from '../utils/email.js';
import { createAccessToken } from '../middleware/auth.js';
import { registerLimiter, resendOtpLimiter, loginLimiter } from '../middleware/rateLimiter.js';
import { getCurrentAcademicSession } from '../utils/academicYear.js';
import { User, PendingUser, College, Profile } from '../models/index.js';

const router = Router();

// ── Constants ───────────────────────────────────────────────────────
const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

const KNOWN_COLLEGE_DOMAINS = new Set([
  'bmsit.in', 'bmsce.in', 'rvce.edu.in', 'msrit.edu', 'pes.edu',
  'dsce.edu.in', 'sjce.ac.in', 'nie.ac.in', 'reva.edu.in', 'cmrit.ac.in',
  'nmit.ac.in', 'sit.ac.in', 'kletech.ac.in', 'manipal.edu', 'vit.ac.in',
  'srmist.edu.in', 'amrita.edu', 'bits-pilani.ac.in',
]);

// ── Internal helpers ────────────────────────────────────────────────

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || 'unknown';
}

async function isCollegeEmail(email) {
  const domain = email.split('@').pop().toLowerCase();
  if (domain === 'gmail.com' || domain === 'yahoo.com' || domain === 'hotmail.com' || domain === 'outlook.com') {
    return false;
  }
  if (domain.includes('iit') || domain.includes('nit')) return true;
  if (domain.includes('.edu') || domain.includes('.ac.in')) return true;
  if (KNOWN_COLLEGE_DOMAINS.has(domain)) return true;
  const college = await College.findOne({ domain });
  return !!college;
}

async function ensureCollegeExists(email) {
  const domain = email.split('@').pop().toLowerCase();
  const college = await College.findOne({ domain });
  if (college) return college.name;

  const name = domain.split('.')[0].toUpperCase();
  await College.create({ name, domain });
  console.log(`[AutoRegister] New college domain registered: ${name} (${domain})`);
  return name;
}

function sanitizeEmail(raw) {
  return (raw || '').trim().toLowerCase();
}

// ── POST /api/register ─────────────────────────────────────────────
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const data = req.body;
    if (!data || !Object.keys(data).length) {
      return res.status(400).json({ error: 'Missing or invalid request body.' });
    }

    const required = ['name', 'email', 'password', 'branch', 'admission_year', 'college'];
    const missing = required.filter((f) => data[f] === undefined || data[f] === null || data[f] === '');
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    const currentSession = getCurrentAcademicSession();
    const admissionYear = parseInt(data.admission_year, 10);
    if (isNaN(admissionYear) || admissionYear > currentSession || admissionYear < currentSession - 6) {
      return res.status(400).json({
        error: `Invalid admission year. Please select a valid year between ${currentSession - 6} and ${currentSession}.`,
      });
    }

    const email = sanitizeEmail(data.email);

    if (!(await isCollegeEmail(email))) {
      return res.status(403).json({
        error: 'Registration is restricted to college email addresses.',
      });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const [ok, reason] = validatePasswordStrength(data.password);
    if (!ok) return res.status(400).json({ error: reason });

    const hashedPw = hashPassword(data.password);
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const collegeName = data.college.trim();

    // Upsert PendingUser
    let pending = await PendingUser.findOne({ email });
    if (pending) {
      pending.name = data.name.trim();
      pending.password = hashedPw;
      pending.branch = data.branch.trim();
      pending.admission_year = admissionYear;
      pending.college = collegeName;
    } else {
      pending = new PendingUser({
        name: data.name.trim(),
        email,
        password: hashedPw,
        branch: data.branch.trim(),
        admission_year: admissionYear,
        college: collegeName,
      });
    }

    pending.otp_hash = otpHash;
    pending.otp_expiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    pending.attempts = 0;
    await pending.save();

    if (!(await sendOtpEmail(email, otp))) {
      await PendingUser.deleteOne({ _id: pending._id });
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    console.log(`[REGISTER] OTP sent to ${email}`);
    return res.status(201).json({
      message: `Verification code sent to ${email}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
      email_sent: true,
    });
  } catch (err) {
    console.error('[REGISTER] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/resend-otp ───────────────────────────────────────────
router.post('/resend-otp', resendOtpLimiter, async (req, res) => {
  try {
    const data = req.body;
    if (!data) return res.status(400).json({ error: 'Missing request body.' });

    const email = sanitizeEmail(data.email || '');
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const pending = await PendingUser.findOne({ email });
    if (!pending) {
      return res.status(404).json({ error: 'No pending registration found for this email.' });
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    pending.otp_hash = otpHash;
    pending.otp_expiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    pending.attempts = 0;
    await pending.save();

    if (!(await sendOtpEmail(email, otp))) {
      return res.status(500).json({ error: 'Failed to send email. Please try again.' });
    }

    console.log(`[RESEND-OTP] New OTP sent to ${email}`);
    return res.status(200).json({ message: 'A new verification code has been sent.', email_sent: true });
  } catch (err) {
    console.error('[RESEND-OTP] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/verify-otp ───────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const data = req.body;
    if (!data) return res.status(400).json({ error: 'Missing request body.' });

    const email = sanitizeEmail(data.email || '');
    const otp = String(data.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const pending = await PendingUser.findOne({ email });
    if (!pending) {
      return res.status(404).json({ error: 'No pending registration found for this email.' });
    }

    // Expiry check
    if (Date.now() > new Date(pending.otp_expiry).getTime()) {
      return res.status(410).json({
        error: 'Verification code has expired. Please request a new one.',
      });
    }

    // Attempt limit
    if (pending.attempts >= MAX_OTP_ATTEMPTS) {
      await PendingUser.deleteOne({ _id: pending._id });
      return res.status(429).json({ error: 'Too many failed attempts. Please register again.' });
    }

    // OTP verification
    if (!verifyOtp(otp, pending.otp_hash)) {
      pending.attempts += 1;
      await pending.save();
      const remaining = MAX_OTP_ATTEMPTS - pending.attempts;
      return res.status(401).json({
        error: 'Invalid verification code.',
        attempts_remaining: remaining,
      });
    }

    // OTP correct: promote PendingUser → User
    const collegeName = await ensureCollegeExists(pending.email);

    const user = await User.create({
      name: pending.name,
      email: pending.email,
      password: pending.password,
      branch: pending.branch,
      admission_year: pending.admission_year,
      college: collegeName,
      is_verified: true,
      college_verified: true,
    });
    await Profile.create({ user: user._id });
    await PendingUser.deleteOne({ _id: pending._id });

    const token = createAccessToken(user._id.toString());
    console.log(`[VERIFY-OTP] User created: ${email}`);

    const userDict = await user.toDict();
    return res.status(200).json({
      message: 'Email verified. Account created successfully!',
      token,
      user: userDict,
    });
  } catch (err) {
    console.error('[VERIFY-OTP] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/login ────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const ip = getClientIp(req);
    const data = req.body;
    if (!data) return res.status(400).json({ error: 'Missing or invalid request body.' });

    const email = sanitizeEmail(data.email || '');
    const password = data.password || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.warn(`[LOGIN-FAIL] Unknown email attempt: email=${email} ip=${ip}`);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Account lockout check
    const now = new Date();
    if (user.locked_until && now < user.locked_until) {
      const remainingSeconds = Math.ceil((user.locked_until.getTime() - now.getTime()) / 1000);
      console.warn(`[LOGIN-LOCKED] email=${email} ip=${ip} locked_for=${remainingSeconds}s`);
      return res.status(423).json({
        error: 'Account temporarily locked due to too many failed attempts.',
        retry_after_seconds: remainingSeconds,
      });
    }

    // Password verification (dual-check)
    const [isValid, needsRehash] = verifyPassword(password, user.password);

    if (!isValid) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
        await User.updateOne(
          { _id: user._id },
          { $set: { failed_login_attempts: newAttempts, locked_until: lockedUntil } }
        );
        console.warn(`[LOGIN-LOCKED] email=${email} ip=${ip} attempts=${newAttempts}`);
        return res.status(423).json({
          error: 'Account temporarily locked due to too many failed attempts.',
          retry_after_seconds: LOCKOUT_DURATION_MINUTES * 60,
        });
      } else {
        await User.updateOne(
          { _id: user._id },
          { $set: { failed_login_attempts: newAttempts } }
        );
        console.warn(`[LOGIN-FAIL] email=${email} ip=${ip} attempts=${newAttempts}/${MAX_LOGIN_ATTEMPTS}`);
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
    }

    // Werkzeug → bcrypt silent migration
    if (needsRehash) {
      try {
        const newHash = hashPassword(password);
        await User.updateOne({ _id: user._id }, { $set: { password: newHash } });
        console.log(`[LOGIN-REHASH] Werkzeug->bcrypt upgrade complete: ${email}`);
      } catch (exc) {
        console.error(`[LOGIN-REHASH-FAIL] email=${email} error=${exc.message}`);
      }
    }

    // Reset lockout counters
    await User.updateOne(
      { _id: user._id },
      { $set: { failed_login_attempts: 0 }, $unset: { locked_until: 1 } }
    );

    // Email verification gate
    if (!user.is_verified) {
      console.log(`[LOGIN-UNVERIFIED] email=${email} ip=${ip}`);
      return res.status(403).json({
        error: 'Email not verified. Please complete email verification.',
        needs_verification: true,
      });
    }

    // Issue JWT
    const token = createAccessToken(user._id.toString());
    console.log(`[LOGIN-OK] email=${email} ip=${ip}`);

    // Background: auto-sync Codeforces stats on login
    try {
      const profile = await Profile.findOne({ user: user._id });
      if (profile && profile.cf_handle) {
        const stats = await syncUserStats(profile.cf_handle);
        profile.cf_rating = stats.cf_rating || 0;
        profile.cf_max_rating = stats.cf_max_rating || 0;
        profile.cf_rank = stats.cf_rank || 'unrated';
        profile.cf_problems_solved = stats.cf_problems_solved || 0;
        profile.avatar_url = stats.avatar_url;
        profile.last_synced = new Date();
        await profile.save();
        await updateUserScores(user._id.toString());
      }
    } catch {
      // Never block login due to stats-sync failure
    }

    const userDict = await user.toDict();
    return res.status(200).json({ token, user: userDict });
  } catch (err) {
    console.error('[LOGIN] Error:', err.message || err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

export default router;
