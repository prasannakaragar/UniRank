/**
 * queue/workers.js
 *
 * BullMQ worker pool for the college scrape queue.
 *
 * Concurrency = config.crawlerConcurrency (default 3).
 * Each worker slot handles one scrape job at a time.
 * Failed jobs (all retries exhausted) are moved to the DLQ queue.
 */

import { Worker } from 'bullmq';
import { config } from '../config/index.js';
import { redisConnection, dlqQueue } from './scrapeQueue.js';
import { runScrapeJob } from '../pipeline/scrapeJob.js';

let worker = null;

export function startWorkers() {
  if (worker) {
    console.warn('[Workers] Worker already started');
    return worker;
  }

  worker = new Worker(
    'college-scrape',
    async (job) => {
      const { collegeDef, categories } = job.data;
      console.log(`[Worker] Processing job ${job.id}: ${collegeDef.name} (${categories.join(',')})`);

      const result = await runScrapeJob({
        collegeDef,
        categories,
        jobId: job.id,
        verbose: config.isDev,
      });

      // Return result so it's visible in BullMQ dashboard / Bull Board
      return result;
    },
    {
      connection: redisConnection,
      concurrency: config.crawlerConcurrency,
      limiter: {
        // Global rate limit across all workers: max 5 jobs per 10s
        max: 5,
        duration: 10_000,
      },
    }
  );

  // ── Event handlers ────────────────────────────────────────────────────────
  worker.on('completed', (job, result) => {
    console.log(
      `[Worker] ✅ ${job.id} completed: ${result?.status ?? 'unknown'} ` +
      `(confidence=${result?.overallConfidence?.toFixed(2) ?? 'n/a'})`
    );
  });

  worker.on('failed', async (job, err) => {
    const attemptsLeft = (job.opts.attempts ?? 3) - (job.attemptsMade ?? 0);
    console.error(`[Worker] ❌ ${job.id} failed (${job.attemptsMade} attempts): ${err.message}`);

    // If all retries exhausted → move to DLQ
    if (attemptsLeft <= 0) {
      try {
        await dlqQueue.add('dlq-job', {
          originalJobId: job.id,
          collegeDef: job.data.collegeDef,
          categories: job.data.categories,
          failedAt: new Date().toISOString(),
          error: err.message,
          attempts: job.attemptsMade,
        });
        console.log(`[Worker] Moved ${job.id} to DLQ`);
      } catch (dlqErr) {
        console.error('[Worker] Failed to move job to DLQ:', dlqErr.message);
      }
    }
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} stalled`);
  });

  console.log(`[Workers] BullMQ worker started (concurrency=${config.crawlerConcurrency})`);
  return worker;
}

export async function stopWorkers() {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[Workers] Worker stopped');
  }
}
