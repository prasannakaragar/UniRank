/**
 * src/index.js
 *
 * Scraper service entry point.
 *
 * Starts:
 *   1. MongoDB connection
 *   2. BullMQ workers (Playwright crawl + LLM extract)
 *   3. Admin dashboard (Express server on ADMIN_PORT)
 *   4. Enqueues all configured colleges (staggered)
 *
 * Run: node src/index.js
 * Dev: npm run dev
 */

import { connectDB, disconnectDB } from './db/connection.js';
import { startWorkers, stopWorkers } from './queue/workers.js';
import { enqueueAll } from './queue/scrapeQueue.js';
import { COLLEGES } from './config/colleges.js';
import { closeBrowser } from './crawler/playwrightCrawler.js';

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║         UniRank College Scraper Service              ║');
  console.log('║         Phase 1 — BullMQ + Gemini Pipeline           ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // ── Connect to MongoDB ────────────────────────────────────────────────────
  await connectDB();

  // ── Start BullMQ workers ──────────────────────────────────────────────────
  startWorkers();

  // ── Start admin dashboard ─────────────────────────────────────────────────
  const { startAdminServer } = await import('./admin/server.js');
  await startAdminServer();

  // ── Enqueue all colleges ──────────────────────────────────────────────────
  console.log(`\n[Main] Enqueueing ${COLLEGES.length} colleges...`);
  await enqueueAll(COLLEGES, ['placements', 'admissions', 'basicInfo']);
  console.log('[Main] All colleges enqueued. Workers are processing...\n');

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`\n[Main] Received ${signal}. Shutting down gracefully...`);
    await stopWorkers();
    await closeBrowser();
    await disconnectDB();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[Main] Fatal startup error:', err);
  process.exit(1);
});
