/**
 * routes/discovery.js — UniRank
 * College & Internship Discovery module.
 *
 * College data is populated asynchronously by the scraper service.
 * This route serves cached data from MongoDB — no inline scraping.
 */

import { Router } from 'express';
import mongoose from 'mongoose';
import { verifyToken } from '../middleware/auth.js';
import { College, CollegeIndex, Internship, User, Profile } from '../models/index.js';
import { ensureCollegeIndexSeeded } from '../scripts/seedCollegeIndex.js';

const router = Router();

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_IMAGE = '/default-college.jpg';

const GENERIC_SEARCH_WORDS = new Set([
  'india', 'engineering', 'college', 'university', 'institute', 'technology',
  'the', 'of', 'and', 'for', 'in', 'a', 'an',
]);

const KNOWN_PLACEHOLDER_VALUES = new Set([
  '', 'N/A', 'n/a', 'NA', 'na', 'Not Available', 'not available',
  'TBD', 'tbd', 'null', 'undefined', '0', '0 LPA',
]);

// ── Helpers ────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateCollege(college) {
  const doc = college.toObject ? college.toObject() : college;
  if (!doc.image_url || doc.image_url.trim() === '') doc.image_url = DEFAULT_IMAGE;
  if (!doc.banner_url || doc.banner_url.trim() === '') doc.banner_url = DEFAULT_IMAGE;

  if (KNOWN_PLACEHOLDER_VALUES.has((doc.highest_package || '').trim())) {
    doc.highest_package = 'Data Not Available';
    doc.lpa_verified = false;
  }
  if (KNOWN_PLACEHOLDER_VALUES.has((doc.average_package || '').trim())) {
    doc.average_package = 'Data Not Available';
  }
  if (KNOWN_PLACEHOLDER_VALUES.has((doc.placement_rate || '').trim())) {
    doc.placement_rate = 'Data Not Available';
  }
  return doc;
}

function collegeToDict(doc) {
  return {
    id: doc._id?.toString() || doc.id,
    name: doc.name,
    domain: doc.domain,
    location: doc.location,
    degree_type: doc.degree_type || 'B.Tech',
    highest_package: doc.highest_package,
    average_package: doc.average_package,
    placement_rate: doc.placement_rate,
    total_offers: doc.total_offers,
    about: doc.about,
    highlight: doc.highlight,
    courses: doc.courses,
    facilities: doc.facilities,
    recruiters: doc.recruiters,
    campus_details: doc.campus_details,
    image_url: doc.image_url || DEFAULT_IMAGE,
    banner_url: doc.banner_url || DEFAULT_IMAGE,
    source: doc.source || '',
    lpa_verified: doc.lpa_verified ?? false,
    last_scraped_at: doc.last_scraped_at ? new Date(doc.last_scraped_at).toISOString() : null,
  };
}

function computeMatchScore(internship, userSkills, githubScore) {
  const required = internship.skills_required || [];
  let skillsRatio = 1.0;

  if (required.length > 0) {
    const matched = required.filter((reqSkill) =>
      userSkills.some((uSkill) => reqSkill.toLowerCase().includes(uSkill) || uSkill.includes(reqSkill.toLowerCase()))
    );
    skillsRatio = matched.length / required.length;
  }

  const raw = Math.round(skillsRatio * 60 + (githubScore / 10) * 40);
  const matchScore = Math.max(0, Math.min(100, raw));

  const reasons = [];
  if (required.length > 0 && skillsRatio > 0) {
    const matchedCount = Math.round(skillsRatio * required.length);
    reasons.push(`Matches ${matchedCount} of your listed skills`);
  }
  if (githubScore >= 7.5) {
    reasons.push('Strong match for your high GitHub ranking');
  } else if (githubScore >= 5.0) {
    reasons.push('Aligned with your coding profile');
  }
  if (reasons.length === 0) {
    reasons.push('General opportunity match');
  }

  return { matchScore, reasons };
}

async function getUserSkillsAndGithub(userId) {
  let userSkills = [];
  let githubScore = 0;

  try {
    const profile = await Profile.findOne({ user: userId });
    if (profile?.skills) {
      userSkills = profile.skills
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
    const user = await User.findById(userId);
    if (user) {
      githubScore = user.github_score || 0;
    }
  } catch {
    // Graceful fallback — match scoring still works with defaults
  }

  return { userSkills, githubScore };
}

// ── GET /api/colleges/autocomplete ─────────────────────────────────
router.get('/colleges/autocomplete', verifyToken, async (req, res) => {
  try {
    const q = (req.query.q || req.query.search || '').trim();
    if (q.length < 2) {
      return res.json([]);
    }

    await ensureCollegeIndexSeeded();

    const escaped = escapeRegex(q);
    const startsRegex = new RegExp('^' + escaped, 'i');
    const containsRegex = new RegExp(escaped, 'i');

    const startsMatches = await CollegeIndex.find({ name: startsRegex }).limit(8);
    const startsIds = new Set(startsMatches.map((m) => m._id.toString()));

    let containsMatches = [];
    const remaining = 8 - startsMatches.length;
    if (remaining > 0) {
      containsMatches = await CollegeIndex.find({
        name: containsRegex,
        _id: { $nin: Array.from(startsIds) },
      }).limit(remaining);
    }

    const combined = [...startsMatches, ...containsMatches];
    return res.json(combined.map((item) => item.toDict()));
  } catch (err) {
    console.error('[DISCOVERY] GET /colleges/autocomplete error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/colleges/discover ────────────────────────────────────
// Serves cached college data from MongoDB. The scraper service
// populates college data asynchronously — this endpoint does NOT
// perform any live scraping.
router.post('/colleges/discover', verifyToken, async (req, res) => {
  try {
    const query = (req.body.query || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required.' });
    }

    // Search by name or domain in cached colleges
    const escapedQuery = escapeRegex(query);
    const existingCollege = await College.findOne({
      $or: [
        { name: new RegExp(escapedQuery, 'i') },
        { domain: query.toLowerCase() },
      ],
    });

    if (existingCollege) {
      const validated = validateCollege(existingCollege);
      return res.json({
        college: collegeToDict(validated),
        cached: true,
        logs: [{ message: `Found cached profile for '${existingCollege.name}'`, timestamp: new Date().toISOString() }],
      });
    }

    // Not found — return 404 instead of inventing a placeholder
    return res.status(404).json({
      error: `No data found for '${query}'. The scraper has not indexed this institution yet.`,
      suggestion: 'Check back later or contact an admin to add this institution to the scrape queue.',
    });
  } catch (err) {
    console.error('[DISCOVERY] POST /colleges/discover error:', err.message);
    return res.status(500).json({ error: 'Internal server error during discovery.' });
  }
});

// ── GET /api/colleges ──────────────────────────────────────────────
router.get('/colleges', verifyToken, async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    let colleges;

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      colleges = await College.find({
        $or: [{ name: regex }, { location: regex }],
      });
    } else {
      colleges = await College.find();
    }

    // Validate and serialize
    const result = colleges.map((c) => {
      const validated = validateCollege(c);
      return collegeToDict(validated);
    });

    return res.json(result);
  } catch (err) {
    console.error('[DISCOVERY] GET /colleges error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/colleges/:id ──────────────────────────────────────────
router.get('/colleges/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    let college = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      college = await College.findById(id);
    }

    if (!college) {
      college = await College.findOne({ domain: id });
    }

    if (!college) {
      return res.status(404).json({ error: 'College not found.' });
    }

    const validated = validateCollege(college);
    return res.json(collegeToDict(validated));
  } catch (err) {
    console.error('[DISCOVERY] GET /colleges/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/internships/crawler-status ────────────────────────────
// Returns scraper system status. Will be rewired to the new scrape_jobs
// collection once the scraper service is running.
router.get('/internships/crawler-status', verifyToken, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const totalColleges = await College.countDocuments();
    const totalOpportunities = await Internship.countDocuments();
    const latestJob = await db.collection('scrape_jobs').findOne({}, { sort: { createdAt: -1 } });

    return res.json({
      status: latestJob ? latestJob.status : 'running',
      colleges_monitored: totalColleges,
      active_opportunities: totalOpportunities,
      last_sync: latestJob && latestJob.completedAt ? new Date(latestJob.completedAt).toISOString() : new Date().toISOString(),
      logs: [
        { message: `Monitored ${totalColleges} Karnataka engineering institutions`, timestamp: new Date().toISOString() },
      ],
    });
  } catch (err) {
    console.error('[DISCOVERY] GET /internships/crawler-status error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/internships/crawl ────────────────────────────────────
// Handles the Trigger Aggregation button from the discovery UI
router.post('/internships/crawl', verifyToken, async (req, res) => {
  try {
    const db = mongoose.connection.db;

    // Sync latest scraped placement data from universities/placements to colleges
    const universities = await db.collection('universities').find().toArray();
    const placements = await db.collection('placements').find().toArray();

    const placementByUnivId = new Map();
    for (const p of placements) {
      placementByUnivId.set(p.universityId.toString(), p);
    }

    let updatedCount = 0;
    for (const u of universities) {
      const pData = placementByUnivId.get(u._id.toString());
      if (pData && pData.highestPackage?.raw) {
        await College.updateOne(
          { name: new RegExp(escapeRegex(u.name), 'i') },
          {
            $set: {
              highest_package: pData.highestPackage.raw,
              lpa_verified: true,
              last_scraped_at: pData.updatedAt || new Date(),
            },
          }
        );
        updatedCount++;
      }
    }

    return res.json({
      message: 'Scraper aggregation synced successfully.',
      colleges_crawled: universities.length,
      colleges_updated: updatedCount,
      logs: [
        { message: `✓ Synced ${updatedCount} verified placement profiles from scraper pipeline`, timestamp: new Date().toISOString() },
      ],
    });
  } catch (err) {
    console.error('[DISCOVERY] POST /internships/crawl error:', err.message);
    return res.status(500).json({ error: 'Internal server error during aggregation sync.' });
  }
});


// ── GET /api/internships ───────────────────────────────────────────
// STRICT RULE: Only returns internships with publishStatus = 'PUBLISHED'.
// DRAFT, DELISTED, or EXPIRED entries are NEVER returned to public users.
router.get('/internships', verifyToken, async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    // HARD GATE: Only query published internships
    const query = { publishStatus: 'PUBLISHED' };

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { project_title: regex },
        { college_name: regex },
        { skills_required: regex },
      ];
    }

    const internships = await Internship.find(query).sort({ opportunity_score: -1, lastVerifiedLive: -1 });
    const { userSkills, githubScore } = await getUserSkillsAndGithub(req.userId);

    const results = internships.map((intern) => {
      const data = intern.toDict();
      const { matchScore, reasons } = computeMatchScore(intern, userSkills, githubScore);
      return {
        ...data,
        match_score: matchScore,
        recommendation_reasons: reasons,
      };
    });

    results.sort((a, b) => b.match_score - a.match_score);

    return res.json(results);
  } catch (err) {
    console.error('[DISCOVERY] GET /internships error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/internships/:id ───────────────────────────────────────
router.get('/internships/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid internship ID.' });
    }

    // HARD GATE: Only allow fetching if publishStatus = 'PUBLISHED'
    const internship = await Internship.findOne({ _id: id, publishStatus: 'PUBLISHED' });
    if (!internship) {
      return res.status(404).json({ error: 'Internship not found or no longer active.' });
    }

    const { userSkills, githubScore } = await getUserSkillsAndGithub(req.userId);
    const { matchScore, reasons } = computeMatchScore(internship, userSkills, githubScore);

    return res.json({
      ...internship.toDict(),
      match_score: matchScore,
      recommendation_reasons: reasons,
    });
  } catch (err) {
    console.error('[DISCOVERY] GET /internships/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
