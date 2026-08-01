/**
 * queue/scrapeQueue.js
 *
 * BullMQ queue definition and job-adding helpers.
 *
 * Queue name: "college-scrape"
 * DLQ name:   "college-scrape:dlq"  (dead-letter queue — populated automatically by BullMQ)
 */

import { Queue } from 'bullmq';
import { config } from '../config/index.js';

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  ...(config.redis.password ? { password: config.redis.password } : {}),
};

// ── Main scrape queue ────────────────────────────────────────────────────────
export const scrapeQueue = new Queue('college-scrape', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30_000,  // 30s initial, then 60s, then 120s
    },
    removeOnComplete: { count: 100 },  // keep last 100 completed jobs
    removeOnFail: false,               // keep failed jobs for DLQ inspection
  },
});

// ── Dead-letter queue ────────────────────────────────────────────────────────
// BullMQ doesn't have a built-in DLQ, but we use a separate Queue to
// manually move jobs here after all retries are exhausted.
export const dlqQueue = new Queue('college-scrape_dlq', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// ── Helper: enqueue one college ───────────────────────────────────────────────
/**
 * @param {{ collegeDef: object, categories: string[] }} payload
 * @param {{ priority?: number, delay?: number }} [opts]
 */
export async function enqueueCollege(collegeDef, categories, opts = {}) {
  const jobId = `scrape:${collegeDef.domain}:${Date.now()}`;
  const job = await scrapeQueue.add(
    'scrape-college',
    { collegeDef, categories },
    {
      jobId,
      priority: collegeDef.tier === 1 ? 10 : collegeDef.tier === 2 ? 5 : 1,
      delay: opts.delay ?? 0,
    }
  );
  return job;
}

/**
 * Enqueue all configured colleges (used at startup).
 * @param {object[]} colleges - from config/colleges.js
 * @param {string[]} [categories]
 */
export async function enqueueAll(colleges, categories = ['placements', 'admissions']) {
  const jobs = [];
  for (const college of colleges) {
    const job = await enqueueCollege(college, categories, {
      // Stagger jobs: 2s per college to avoid hammering BullMQ at startup
      delay: jobs.length * 2000,
    });
    jobs.push(job);
  }
  console.log(`[Queue] Enqueued ${jobs.length} colleges`);
  return jobs;
}

export { redisConnection };
