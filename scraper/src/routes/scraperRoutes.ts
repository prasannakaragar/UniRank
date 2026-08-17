/**
 * routes/scraperRoutes.ts
 *
 * REST API endpoints for scraper control, status monitoring, admin review,
 * and querying scraped university data (§15).
 */

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { University } from '../models/University.js';
import { Placement } from '../models/Placement.js';
import { NirfRanking } from '../models/NirfRanking.js';
import { ScrapeJob } from '../models/ScrapeJob.js';
import { DataReview } from '../models/DataReview.js';
import { scrapeUniversity } from '../pipeline/scrapeOrchestrator.js';

const router = Router();

// ── Auth Middleware ──────────────────────────────────────────────────────────

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization token.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }
}

// ── Scraper Control Endpoints (Admin Only) ───────────────────────────────────

/**
 * POST /api/scraper/university/:id
 * Trigger an on-demand scrape for a specific university.
 */
router.post('/scraper/university/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const university = await University.findById(id);

    if (!university) {
      return res.status(404).json({ error: 'University not found' });
    }

    // Fire scrape asynchronously (or await if requested)
    const runAsync = req.query.async === 'true';

    if (runAsync) {
      scrapeUniversity(university, 'manual').catch(err => {
        console.error(`Async scrape error for ${university.name}:`, err);
      });
      return res.json({ message: `Scrape job queued for ${university.name}`, universityId: university._id });
    } else {
      const result = await scrapeUniversity(university, 'manual');
      return res.json(result);
    }
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/scraper/bulk
 * Trigger bulk scrape across all scrapingAllowed universities.
 */
router.post('/scraper/bulk', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.body.limit || '10', 10);
    const universities = await University.find({ scrapingAllowed: true }).limit(limit);

    if (universities.length === 0) {
      return res.json({ message: 'No eligible universities found with scrapingAllowed=true' });
    }

    // Launch background batch
    (async () => {
      for (const univ of universities) {
        await scrapeUniversity(univ, 'bulk');
      }
    })();

    return res.json({
      message: `Bulk scrape started for ${universities.length} universities`,
      targetUniversities: universities.map(u => ({ id: u._id, name: u.name })),
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/scraper/jobs
 * List scrape jobs with status filtering.
 */
router.get('/scraper/jobs', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { status, limit = '20' } = req.query;
    const query: any = {};
    if (status) query.status = status;

    const jobs = await ScrapeJob.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string, 10))
      .populate('universityId', 'name state officialWebsite');

    return res.json(jobs);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/scraper/jobs/:id
 * Get detail status of a single scrape job.
 */
router.get('/scraper/jobs/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const job = await ScrapeJob.findById(req.params.id).populate('universityId');
    if (!job) {
      return res.status(404).json({ error: 'Scrape job not found' });
    }
    return res.json(job);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/scraper/reviews
 * Get items pending admin review (low confidence extractions).
 */
router.get('/scraper/reviews', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { status = 'pending' } = req.query;
    const reviews = await DataReview.find({ status })
      .sort({ createdAt: -1 })
      .populate('universityId', 'name city state');

    return res.json(reviews);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/scraper/internships/verify
 * Trigger verification and promotion pipeline for DRAFT internships.
 */
router.post('/scraper/internships/verify', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const { verifyAndPromoteDrafts } = await import('../services/internshipVerifier.js');
    const result = await verifyAndPromoteDrafts();
    return res.json({ message: 'Internship verification completed', ...result });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/scraper/internships/recheck
 * Trigger live re-check for all PUBLISHED internships.
 */
router.post('/scraper/internships/recheck', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const { recheckPublishedInternships } = await import('../services/internshipVerifier.js');
    const result = await recheckPublishedInternships();
    return res.json({ message: 'Published internships re-check completed', ...result });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/scraper/reviews/:id/approve
 * Approve or edit an extraction review item.
 */
router.post('/scraper/reviews/:id/approve', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { editedValue, notes } = req.body;

    const review = await DataReview.findById(id);
    if (!review) return res.status(404).json({ error: 'Review item not found' });

    review.status = editedValue ? 'edited' : 'approved';
    review.reviewedBy = (req as any).user?.sub || 'admin';
    review.reviewedAt = new Date();
    if (notes) review.notes = notes;

    await review.save();
    return res.json({ message: 'Review updated successfully', review });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ── Public / Application Data Endpoints ─────────────────────────────────────

/**
 * GET /api/universities
 * List scraped universities.
 */
router.get('/universities', async (req: Request, res: Response) => {
  try {
    const { state, type, search } = req.query;
    const query: any = {};

    if (state) query.state = new RegExp(state as string, 'i');
    if (type) query.institutionType = type;
    if (search) query.name = new RegExp(search as string, 'i');

    const universities = await University.find(query).sort({ name: 1 });
    return res.json(universities);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/universities/:id
 * Get single university detail.
 */
router.get('/universities/:id', async (req: Request, res: Response) => {
  try {
    const univ = await University.findById(req.params.id);
    if (!univ) return res.status(404).json({ error: 'University not found' });
    return res.json(univ);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/universities/:id/placements
 * Get historical placement data for a university.
 */
router.get('/universities/:id/placements', async (req: Request, res: Response) => {
  try {
    const placements = await Placement.find({ universityId: req.params.id }).sort({ year: -1 });
    return res.json(placements);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/universities/:id/rankings
 * Get historical NIRF rankings for a university.
 */
router.get('/universities/:id/rankings', async (req: Request, res: Response) => {
  try {
    const rankings = await NirfRanking.find({ universityId: req.params.id }).sort({ year: -1 });
    return res.json(rankings);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/universities/:id/internships
 * Stub for Phase 2 internship data.
 */
router.get('/universities/:id/internships', async (req: Request, res: Response) => {
  return res.json([]);
});

export default router;
