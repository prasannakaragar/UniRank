/**
 * utils/password.js — UniRank
 * Central module for all password security logic.
 *
 * - Hashing new passwords with bcrypt
 * - Verifying passwords against bcrypt OR legacy Werkzeug PBKDF2 hashes
 * - Enforcing strong password policy
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_LOG_ROUNDS || '12', 10);

// ── Hash-format detectors ──────────────────────────────────────────

function isBcryptHash(stored) {
  if (!stored || stored.length !== 60) return false;
  return (
    stored.startsWith('$2b$') ||
    stored.startsWith('$2a$') ||
    stored.startsWith('$2y$')
  );
}

function isWerkzeugHash(stored) {
  if (!stored) return false;
  return (
    stored.startsWith('pbkdf2:sha256:') ||
    stored.startsWith('pbkdf2:sha1:') ||
    stored.startsWith('scrypt:') ||
    stored.startsWith('sha1$')
  );
}

/**
 * Verify a Werkzeug PBKDF2 hash using Node.js crypto.
 *
 * Format: "pbkdf2:sha256:<iterations>$<salt>$<hash>"
 * The hash is hex-encoded in Werkzeug.
 */
function verifyWerkzeugHash(plain, stored) {
  try {
    // Parse: "pbkdf2:sha256:260000$salt$hash"
    const parts = stored.split('$');
    if (parts.length < 3) return false;

    const methodPart = parts[0]; // "pbkdf2:sha256:260000"
    const salt = parts[1];
    const storedHash = parts[2];

    const methodParts = methodPart.split(':');
    if (methodParts.length < 3) return false;

    const hashFunc = methodParts[1]; // "sha256"
    const iterations = parseInt(methodParts[2], 10);

    // Werkzeug produces hex-encoded hashes
    const keyLen = Buffer.from(storedHash, 'hex').length;
    const derived = crypto.pbkdf2Sync(plain, salt, iterations, keyLen, hashFunc);
    const derivedHex = derived.toString('hex');

    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(derivedHex, 'utf8'),
      Buffer.from(storedHash, 'utf8')
    );
  } catch {
    return false;
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Hash a plain-text password using bcrypt.
 * @param {string} plain
 * @returns {string} 60-character bcrypt hash
 */
export function hashPassword(plain) {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

/**
 * Verify `plain` against `stored` hash.
 *
 * Returns: [isValid, needsRehash]
 *   - bcrypt hash   → verify with bcrypt, needsRehash = false
 *   - Werkzeug hash → verify with PBKDF2, needsRehash = true
 *   - Unknown       → [false, false]
 */
export function verifyPassword(plain, stored) {
  if (!plain || !stored) return [false, false];

  // Fast path: bcrypt hash
  if (isBcryptHash(stored)) {
    try {
      return [bcrypt.compareSync(plain, stored), false];
    } catch {
      console.warn('bcrypt.compareSync raised an exception; hash may be corrupted.');
      return [false, false];
    }
  }

  // Migration path: Werkzeug hash
  if (isWerkzeugHash(stored)) {
    try {
      const valid = verifyWerkzeugHash(plain, stored);
      return [valid, true]; // needs rehash to bcrypt
    } catch {
      console.warn('Werkzeug hash verification raised an exception.');
      return [false, false];
    }
  }

  // Unknown format
  console.error(
    `verifyPassword: unrecognised password format (len=${stored.length}, ` +
    `prefix=${stored.substring(0, 12)}). Returning invalid.`
  );
  return [false, false];
}

/**
 * Enforce strong password policy.
 * Returns: [ok, reason]
 */
export function validatePasswordStrength(plain) {
  if (!plain) return [false, 'Password is required.'];
  if (plain.length < 8)
    return [false, 'Password must be at least 8 characters long.'];
  if (!/[A-Z]/.test(plain))
    return [false, 'Password must contain at least one uppercase letter.'];
  if (!/[a-z]/.test(plain))
    return [false, 'Password must contain at least one lowercase letter.'];
  if (!/\d/.test(plain))
    return [false, 'Password must contain at least one number.'];
  if (!/[!@#$%^&*()\-_=+\[\]{}|;':",.\/<>?`~\\]/.test(plain))
    return [false, 'Password must contain at least one special character.'];
  return [true, null];
}

// Also export helpers for migration script
export { isBcryptHash, isWerkzeugHash };
