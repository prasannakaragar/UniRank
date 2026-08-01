/**
 * admin/routes.js
 *
 * REST API routes for the admin review dashboard.
 * All routes require admin JWT (same secret as main backend).
 *
 * Endpoints:
 *   GET  /admin/colleges              — paginated list with scrape status
 *   GET  /admin/colleges/:id          — full college document
 *   PUT  /admin/colleges/:id/approve  — set verifiedByAdmin: true
 *   PUT  /admin/colleges/:id/reject   — set status needs_review, add note
 *   PUT  /admin/colleges/:id/edit     — patch any field
 *   POST /admin/colleges/:id/rescrape — re-enqueue for fresh scrape
 *   GET  /admin/dlq                   — dead-letter queue contents
 *   POST /admin/dlq/:jobId/retry      — retry a DLQ job from college-scrape_dlq
 *   GET  /admin/logs                  — recent scrape logs
 *   GET  /admin/circuits              — circuit breaker status per domain
 *   POST /admin/circuits/:domain/reset — reset a circuit manually
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import College from '../db/College.model.js';
import ScrapeLog from '../db/ScrapeLog.model.js';
import { config } from '../config/index.js';
import { getCircuitSnapshot, resetCircuit } from '../crawler/circuitBreaker.js';
import { dlqQueue, enqueueCollege } from '../queue/scrapeQueue.js';
import { findCollegeByName, getCollegeByDomain } from '../config/colleges.js';

const router = Router();

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), config.jwtSecret);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

router.use(requireAdmin);

// ── GET /admin/colleges ────────────────────────────────────────────────────────
router.get('/colleges', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const status = req.query.status; // filter by scrapeStatus
    const verified = req.query.verified; // 'true' | 'false'
    const sort = req.query.sort || 'confidence_asc'; // newest | oldest | confidence_asc | confidence_desc

    const query = {};
    if (status) query['scrapeMeta.scrapeStatus'] = status;
    if (verified === 'true') query['scrapeMeta.verifiedByAdmin'] = true;
    if (verified === 'false') query['scrapeMeta.verifiedByAdmin'] = { $ne: true };

    const sortMap = {
      newest: { 'scrapeMeta.lastScrapedAt': -1 },
      oldest: { 'scrapeMeta.lastScrapedAt': 1 },
      confidence_asc: { 'scrapeMeta.confidenceScore': 1 },
      confidence_desc: { 'scrapeMeta.confidenceScore': -1 },
    };

    const [colleges, total] = await Promise.all([
      College.find(query, {
        name: 1, domain: 1, tier: 1, collegeType: 1, scrapeMeta: 1,
      })
        .sort(sortMap[sort] ?? sortMap.confidence_asc)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      College.countDocuments(query),
    ]);

    res.json({
      colleges,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/colleges/:id ──────────────────────────────────────────────────
router.get('/colleges/:id', async (req, res) => {
  try {
    const college = await College.findById(req.params.id).lean();
    if (!college) return res.status(404).json({ error: 'College not found' });

    // Include recent logs
    const logs = await ScrapeLog.find({ collegeId: college._id })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    res.json({ college, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /admin/colleges/:id/approve ─────────────────────────────────────────
router.put('/colleges/:id/approve', async (req, res) => {
  try {
    const college = await College.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          'scrapeMeta.verifiedByAdmin': true,
          'scrapeMeta.scrapeStatus': 'success',
          'scrapeMeta.reviewNotes': req.body.notes ?? null,
        },
      },
      { new: true }
    );
    if (!college) return res.status(404).json({ error: 'College not found' });

    await ScrapeLog.create({
      collegeId: college._id,
      collegeName: college.name,
      collegeDomain: college.domain,
      category: 'system',
      level: 'info',
      message: `Admin approved: ${req.admin?.email ?? 'unknown'}`,
      timestamp: new Date(),
    });

    res.json({ success: true, college });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /admin/colleges/:id/reject ───────────────────────────────────────────
router.put('/colleges/:id/reject', async (req, res) => {
  try {
    const college = await College.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          'scrapeMeta.verifiedByAdmin': false,
          'scrapeMeta.scrapeStatus': 'needs_review',
          'scrapeMeta.reviewNotes': req.body.notes ?? 'Rejected by admin',
        },
      },
      { new: true }
    );
    if (!college) return res.status(404).json({ error: 'College not found' });

    await ScrapeLog.create({
      collegeId: college._id,
      collegeName: college.name,
      collegeDomain: college.domain,
      category: 'system',
      level: 'warn',
      message: `Admin rejected: ${req.body.notes ?? 'no reason given'}`,
      timestamp: new Date(),
    });

    res.json({ success: true, college });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /admin/colleges/:id/edit ─────────────────────────────────────────────
router.put('/colleges/:id/edit', async (req, res) => {
  try {
    // Only allow editing scrapedData and scrapeMeta fields
    const allowedTopLevel = ['scrapedData', 'scrapeMeta'];
    const update = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedTopLevel.some((k) => key.startsWith(k))) {
        update[key] = value;
      }
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    const college = await College.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );
    if (!college) return res.status(404).json({ error: 'College not found' });

    await ScrapeLog.create({
      collegeId: college._id,
      collegeName: college.name,
      collegeDomain: college.domain,
      category: 'system',
      level: 'info',
      message: `Admin edited fields: ${Object.keys(update).join(', ')}`,
      timestamp: new Date(),
    });

    res.json({ success: true, college });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /admin/colleges/:id/rescrape ───────────────────────────────────────
router.post('/colleges/:id/rescrape', async (req, res) => {
  try {
    const college = await College.findById(req.params.id).lean();
    if (!college) return res.status(404).json({ error: 'College not found' });

    const collegeDef = getCollegeByDomain(college.domain) ?? findCollegeByName(college.name);
    if (!collegeDef) {
      return res.status(404).json({ error: 'College not in configured list — add it to colleges.js first' });
    }

    const categories = req.body.categories ?? ['placements', 'admissions'];
    const job = await enqueueCollege(collegeDef, categories);
    res.json({ success: true, jobId: job.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/dlq ────────────────────────────────────────────────────────────
router.get('/dlq', async (req, res) => {
  try {
    const jobs = await dlqQueue.getJobs(['waiting', 'delayed', 'failed'], 0, 50);
    const formatted = jobs.map((j) => ({
      id: j.id,
      name: j.name,
      data: j.data,
      attemptsMade: j.attemptsMade,
      failedAt: j.data?.failedAt,
      error: j.data?.error,
      timestamp: j.timestamp,
    }));
    res.json({ jobs: formatted, count: formatted.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /admin/dlq/:jobId/retry ──────────────────────────────────────────────
router.post('/dlq/:jobId/retry', async (req, res) => {
  try {
    const jobs = await dlqQueue.getJobs(['waiting', 'delayed']);
    const job = jobs.find((j) => j.id === req.params.jobId);
    if (!job) return res.status(404).json({ error: 'DLQ job not found' });

    // Re-enqueue into the main queue
    const { collegeDef, categories } = job.data;
    const newJob = await enqueueCollege(collegeDef, categories ?? ['placements', 'admissions']);

    // Remove from DLQ
    await job.remove();

    res.json({ success: true, newJobId: newJob.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/logs ───────────────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit) || 50);
    const level = req.query.level;
    const domain = req.query.domain;

    const query = {};
    if (level) query.level = level;
    if (domain) query.collegeDomain = domain;

    const logs = await ScrapeLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json({ logs, count: logs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/circuits ───────────────────────────────────────────────────────
router.get('/circuits', (_req, res) => {
  res.json({ circuits: getCircuitSnapshot() });
});

// ── POST /admin/circuits/:domain/reset ────────────────────────────────────────
router.post('/circuits/:domain/reset', (req, res) => {
  resetCircuit(req.params.domain);
  res.json({ success: true, domain: req.params.domain });
});

export default router;
