/**
 * crawler/circuitBreaker.js
 *
 * In-memory per-domain circuit breaker.
 *
 * States:
 *   CLOSED  → normal operation
 *   OPEN    → domain is blocked; jobs fail immediately without retrying
 *   HALF_OPEN → one probe request allowed after reset timeout
 *
 * Phase 1: in-memory (resets on worker restart).
 * Phase 3: back this with Redis sorted sets for multi-worker persistence.
 */

import { config } from '../config/index.js';

// Map<domain, { state, failures, openedAt }>
const registry = new Map();

const CLOSED = 'CLOSED';
const OPEN = 'OPEN';
const HALF_OPEN = 'HALF_OPEN';

/**
 * Returns current circuit state for a domain.
 * Auto-transitions OPEN → HALF_OPEN after the reset timeout.
 */
function getState(domain) {
  const entry = registry.get(domain);
  if (!entry) return CLOSED;

  if (entry.state === OPEN) {
    const resetMs = config.circuitBreakerResetMinutes * 60 * 1000;
    if (Date.now() - entry.openedAt >= resetMs) {
      entry.state = HALF_OPEN;
      registry.set(domain, entry);
    }
  }
  return entry.state;
}

/**
 * Call this before every request to check whether the circuit allows it.
 * Throws CircuitOpenError if the circuit is OPEN.
 */
export function checkCircuit(domain) {
  const state = getState(domain);
  if (state === OPEN) {
    const entry = registry.get(domain);
    throw new CircuitOpenError(
      domain,
      entry.failures,
      new Date(entry.openedAt)
    );
  }
}

/**
 * Call this on a successful response to record success.
 * HALF_OPEN → CLOSED (resets failure count).
 */
export function recordSuccess(domain) {
  const entry = registry.get(domain);
  if (!entry) return;
  entry.state = CLOSED;
  entry.failures = 0;
  entry.openedAt = null;
  registry.set(domain, entry);
}

/**
 * Call this on a failed request.
 * Increments failure count; opens circuit after threshold.
 * @returns {{ failures: number, circuitOpened: boolean }}
 */
export function recordFailure(domain) {
  const entry = registry.get(domain) ?? { state: CLOSED, failures: 0, openedAt: null };
  entry.failures += 1;

  const threshold = config.circuitBreakerThreshold;
  if (entry.failures >= threshold && entry.state !== OPEN) {
    entry.state = OPEN;
    entry.openedAt = Date.now();
    console.warn(
      `[CircuitBreaker] ⚡ Circuit OPENED for ${domain} after ${entry.failures} consecutive failures`
    );
    registry.set(domain, entry);
    return { failures: entry.failures, circuitOpened: true };
  }

  registry.set(domain, entry);
  return { failures: entry.failures, circuitOpened: false };
}

/**
 * Returns a summary snapshot of all tracked domains.
 * Used by the admin dashboard to show domain health.
 */
export function getCircuitSnapshot() {
  const result = [];
  for (const [domain, entry] of registry.entries()) {
    result.push({
      domain,
      state: getState(domain), // auto-advances OPEN→HALF_OPEN
      failures: entry.failures,
      openedAt: entry.openedAt ? new Date(entry.openedAt).toISOString() : null,
    });
  }
  return result;
}

/**
 * Manually reset a circuit (admin action).
 */
export function resetCircuit(domain) {
  registry.delete(domain);
}

export class CircuitOpenError extends Error {
  constructor(domain, failures, openedAt) {
    super(`Circuit OPEN for ${domain} (${failures} failures, opened at ${openedAt.toISOString()})`);
    this.name = 'CircuitOpenError';
    this.domain = domain;
    this.failures = failures;
    this.openedAt = openedAt;
  }
}
