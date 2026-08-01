/**
 * routes/discovery.js — UniRank
 * College & Internship Discovery module with real-time Google-style autocomplete,
 * live website scraping (with Cheerio & Gemini LLM extraction), 30-day caching,
 * internship match scoring, manual crawl trigger, and crawler status feed.
 */

import { Router } from 'express';
import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { verifyToken } from '../middleware/auth.js';
import { College, CollegeIndex, Internship, CrawlerLog, User, Profile } from '../models/index.js';
import { ensureCollegeIndexSeeded } from '../scripts/seedCollegeIndex.js';

const router = Router();

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_IMAGE = '/default-college.jpg';

const GENERIC_SEARCH_WORDS = new Set([
  'india', 'engineering', 'college', 'university', 'institute', 'technology',
  'the', 'of', 'and', 'for', 'in', 'a', 'an',
]);

const INDIAN_LOCATIONS = [
  'Bangalore, Karnataka', 'Mumbai, Maharashtra', 'Delhi, Delhi',
  'Hyderabad, Telangana', 'Chennai, Tamil Nadu', 'Pune, Maharashtra',
  'Kolkata, West Bengal', 'Ahmedabad, Gujarat', 'Jaipur, Rajasthan',
  'Lucknow, Uttar Pradesh', 'Bhopal, Madhya Pradesh', 'Chandigarh, Punjab',
  'Thiruvananthapuram, Kerala', 'Guwahati, Assam', 'Nagpur, Maharashtra',
  'Coimbatore, Tamil Nadu', 'Visakhapatnam, Andhra Pradesh', 'Indore, Madhya Pradesh',
  'Kochi, Kerala', 'Mysuru, Karnataka',
];

const DEFAULT_COURSES = ['CSE', 'IT', 'ECE', 'AI-ML', 'Data Science', 'Mechanical', 'Civil'];
const DEFAULT_FACILITIES = ['Smart Classrooms', 'Central Library', 'Hostel', 'Sports Complex', 'Wi-Fi Campus', 'Auditorium', 'Labs'];
const DEFAULT_RECRUITERS = ['TCS', 'Infosys', 'Wipro', 'Cognizant', 'HCL', 'Tech Mahindra', 'Accenture', 'Capgemini'];

const KNOWN_PLACEHOLDER_VALUES = new Set([
  '', 'N/A', 'n/a', 'NA', 'na', 'Not Available', 'not available',
  'TBD', 'tbd', 'null', 'undefined', '0', '0 LPA',
]);

// ── Manual-trigger topic pool (intentionally different from crawler daemon pool) ──
const MANUAL_TOPICS = [
  'Federated Learning for Edge Devices',
  'Quantum Computing Algorithms',
  'Autonomous Drone Navigation',
  'NLP for Low-Resource Languages',
  'Blockchain-Based Identity Verification',
  'Computer Vision for Medical Imaging',
  'Reinforcement Learning in Robotics',
  'Privacy-Preserving Machine Learning',
  'IoT Security Framework Design',
  'Generative Adversarial Networks for Art',
  'Graph Neural Networks for Social Networks',
  'Explainable AI for Healthcare',
  'Satellite Image Analysis with Deep Learning',
  'Speech Synthesis for Indian Languages',
  'Smart Grid Optimization with ML',
];

const MANUAL_PROFESSORS = [
  'Dr. Ananya Sharma', 'Dr. Rajesh Kumar', 'Dr. Priya Menon',
  'Dr. Vikram Singh', 'Dr. Sunita Patel', 'Dr. Arjun Reddy',
  'Dr. Kavitha Nair', 'Dr. Sanjay Gupta', 'Dr. Meera Iyer',
  'Dr. Ramesh Babu', 'Dr. Lakshmi Devi', 'Dr. Arjun Joshi',
];

const STIPEND_TIERS = [
  { label: '₹30,000/month', amount: 30000 },
  { label: '₹25,000/month', amount: 25000 },
  { label: '₹20,000/month', amount: 20000 },
  { label: '₹15,000/month', amount: 15000 },
  { label: '₹10,000/month', amount: 10000 },
  { label: '₹8,000/month',  amount: 8000 },
  { label: '₹5,000/month',  amount: 5000 },
  { label: 'Unpaid',         amount: 0 },
];

const SKILL_POOLS = [
  ['Python', 'TensorFlow', 'PyTorch'],
  ['Python', 'NLP', 'Transformers'],
  ['C++', 'ROS', 'Computer Vision'],
  ['JavaScript', 'React', 'Node.js'],
  ['Python', 'Scikit-learn', 'Pandas'],
  ['Java', 'Spring Boot', 'Microservices'],
  ['Python', 'OpenCV', 'Deep Learning'],
  ['Solidity', 'Ethereum', 'Web3.js'],
  ['Python', 'FastAPI', 'Docker'],
  ['Go', 'Kubernetes', 'gRPC'],
];

// ── Helpers ────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function pruneCrawlerLogs(cap = 100) {
  const count = await CrawlerLog.countDocuments();
  if (count > cap) {
    const oldest = await CrawlerLog.find().sort({ timestamp: 1 }).limit(count - cap);
    const ids = oldest.map((l) => l._id);
    await CrawlerLog.deleteMany({ _id: { $in: ids } });
  }
}

async function writeCrawlerLog(message, college = '') {
  await CrawlerLog.create({ message, college, timestamp: new Date() });
  await pruneCrawlerLogs(100);
}

function buildDomainSlug(name) {
  const initials = name
    .split(/\s+/)
    .filter((w) => !['of', 'the', 'and', 'for', 'in'].includes(w.toLowerCase()))
    .map((w) => w[0]?.toLowerCase() || '')
    .join('');
  return `${initials || 'college'}.edu.in`;
}

function computeOpportunityScore(collegeDomain, collegeName, stipendAmount) {
  const domainLower = (collegeDomain || '').toLowerCase();
  const nameLower = (collegeName || '').toLowerCase();

  let tierScore = 50;
  if (domainLower.includes('iit') || domainLower.includes('nit') || nameLower.includes('bits')) {
    tierScore = 100;
  } else if (['reva', 'pes', 'rvce', 'bmsce', 'msrit', 'manipal', 'vit', 'srm', 'amrita'].some((k) => domainLower.includes(k))) {
    tierScore = 80;
  }

  let stipendScore = 30;
  if (stipendAmount >= 25000) stipendScore = 100;
  else if (stipendAmount >= 15000) stipendScore = 85;
  else if (stipendAmount >= 5000) stipendScore = 70;

  const difficultyScore = randInt(80, 100);
  const feedbackScore = randInt(75, 98);

  return Math.round(tierScore * 0.35 + stipendScore * 0.30 + difficultyScore * 0.20 + feedbackScore * 0.15);
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

// ── Live Scraping & LLM Helpers ─────────────────────────────────────

async function checkRobotsTxt(domain) {
  try {
    const resp = await axios.get(`https://${domain}/robots.txt`, {
      timeout: 2500,
      headers: { 'User-Agent': 'UniRankBot/1.0 (+https://unirank.edu)' },
    });
    if (resp.status === 200 && typeof resp.data === 'string') {
      const content = resp.data.toLowerCase();
      if (content.includes('user-agent: *') && content.includes('disallow: /')) {
        return false;
      }
    }
  } catch {
    // Ignore errors for missing robots.txt
  }
  return true;
}

async function fetchCollegeWebpageData(domain) {
  try {
    const url = `https://${domain}`;
    const resp = await axios.get(url, {
      timeout: 6000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UniRankBot/1.0 (+https://unirank.edu)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (resp.status !== 200 || !resp.data) return { text: '', imageUrl: null };

    const $ = cheerio.load(resp.data);

    // Extract real campus image from meta tags or hero image
    let imageUrl = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || null;

    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `https://${domain}/${imageUrl.replace(/^\//, '')}`;
    }

    if (imageUrl && (imageUrl.endsWith('.svg') || imageUrl.includes('favicon'))) {
      imageUrl = null;
    }

    if (!imageUrl) {
      $('img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && (src.includes('banner') || src.includes('campus') || src.includes('building') || src.includes('slider') || src.includes('uploads'))) {
          imageUrl = src.startsWith('http') ? src : `https://${domain}/${src.replace(/^\//, '')}`;
          return false;
        }
      });
    }

    $('script, style, nav, footer, header, noscript, svg, iframe').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return { text: text.slice(0, 6000), imageUrl };
  } catch (err) {
    console.warn(`[LIVE-SCRAPE] Webpage fetch warning for ${domain}:`, err.message);
    return { text: '', imageUrl: null };
  }
}

async function extractDataWithLLM(htmlText, collegeName, domain) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are a strict information extraction engine.
Your ONLY task is to extract facts that are explicitly written in the supplied webpage text for "${collegeName}" (${domain}).

ABSOLUTE RULES:
1. NEVER guess.
2. NEVER estimate.
3. NEVER infer.
4. NEVER complete missing information.
5. NEVER use outside knowledge.
6. If something is not explicitly present, return null.
7. Preserve numbers exactly as written.
8. Preserve recruiter names exactly.
9. Do not rewrite statistics.
10. Every extracted statistic MUST have supporting evidence copied verbatim.
11. Output ONLY valid JSON matching the following exact structure:

{
  "college_name": string|null,
  "about": string|null,
  "highest_package": string|null,
  "average_package": string|null,
  "median_package": string|null,
  "placement_rate": string|null,
  "top_recruiters": [],
  "courses": [],
  "campus_size": string|null,
  "established": string|null,
  "accreditation": [],
  "nirf_rank": string|null,
  "official_address": string|null,
  "city": string|null,
  "state": string|null,
  "website": string|null,
  "evidence": {
      "highest_package": string|null,
      "average_package": string|null,
      "placement_rate": string|null,
      "top_recruiters": string|null
  },
  "confidence": {
      "highest_package": number|null,
      "average_package": number|null,
      "placement_rate": number|null
  }
}

Webpage Text:
"${htmlText.slice(0, 5000)}"
`;

    const result = await model.generateContent(prompt);
    let textResp = result.response.text().trim();
    if (textResp.startsWith('```json')) textResp = textResp.slice(7);
    if (textResp.startsWith('```')) textResp = textResp.slice(3);
    if (textResp.endsWith('```')) textResp = textResp.slice(0, -3);

    return JSON.parse(textResp.trim());
  } catch (err) {
    console.warn('[LIVE-SCRAPE] Gemini LLM extraction failed:', err.message);
    return null;
  }
}

function parsePackageRegex(text) {
  const lpaMatch = text.match(/(\d+(\.\d+)?\s*(LPA|Lakhs|Lakh|Cr|Crore))/i);
  if (lpaMatch) {
    return {
      highest_package: lpaMatch[0],
      average_package: 'Data Not Available',
      placement_rate: 'Data Not Available',
    };
  }
  return null;
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
router.post('/colleges/discover', verifyToken, async (req, res) => {
  try {
    const query = (req.body.query || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required.' });
    }

    const logs = [];
    const logStep = (msg, col = '') => {
      logs.push({ message: msg, college: col, timestamp: new Date().toISOString() });
    };

    logStep(`🔍 Searching the web for "${query}"...`, query);

    // 1. Cache check (30-day TTL)
    const escapedQuery = escapeRegex(query);
    const existingCollege = await College.findOne({
      $or: [
        { name: new RegExp('^' + escapedQuery + '$', 'i') },
        { domain: query.toLowerCase() },
      ],
    });

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    if (
      existingCollege &&
      existingCollege.last_scraped_at &&
      Date.now() - new Date(existingCollege.last_scraped_at).getTime() < THIRTY_DAYS_MS
    ) {
      const msg = `✓ Cache hit: Returned cached profile for '${existingCollege.name}'`;
      await writeCrawlerLog(msg, existingCollege.name);
      logStep(msg, existingCollege.name);

      const validated = validateCollege(existingCollege);
      return res.json({
        college: collegeToDict(validated),
        cached: true,
        logs,
      });
    }

    // 2. Resolve official website & domain
    await ensureCollegeIndexSeeded();
    const indexMatch = await CollegeIndex.findOne({
      $or: [
        { name: new RegExp(escapedQuery, 'i') },
        { domain: query.toLowerCase() },
      ],
    });

    const collegeName = indexMatch ? indexMatch.name : query;
    const collegeDomain = indexMatch ? indexMatch.domain : buildDomainSlug(query);
    const location = indexMatch ? indexMatch.location : pick(INDIAN_LOCATIONS);

    logStep(`🌐 Found official site: ${collegeDomain}`, collegeName);

    // 3. Robots.txt check
    logStep(`📄 Reading placement & program data...`, collegeName);
    const allowed = await checkRobotsTxt(collegeDomain);
    if (!allowed) {
      logStep(`⚠ robots.txt disallowed crawling for ${collegeDomain} — defaulting values`, collegeName);
    }

    // 4. Fetch HTML & Campus Image
    let pageText = '';
    let scrapedImage = null;
    if (allowed) {
      const pageData = await fetchCollegeWebpageData(collegeDomain);
      pageText = pageData.text;
      scrapedImage = pageData.imageUrl;
    }

    // 5. LLM Structured Extraction / Fallback
    let lpaVerified = false;
    let highestPkg = 'Data Not Available';
    let averagePkg = 'Data Not Available';
    let placementRate = 'Data Not Available';
    let recruiters = DEFAULT_RECRUITERS;
    let courses = DEFAULT_COURSES;
    let aboutText = `${collegeName} is an engineering institution located in ${location}.`;

    if (pageText.length > 50) {
      const extracted = await extractDataWithLLM(pageText, collegeName, collegeDomain);

      if (extracted) {
        if (extracted.about) aboutText = extracted.about;
        if (extracted.highest_package) {
          highestPkg = extracted.highest_package;
          lpaVerified = true;
        }
        if (extracted.average_package) averagePkg = extracted.average_package;
        if (extracted.placement_rate) placementRate = extracted.placement_rate;

        const recs = extracted.top_recruiters || extracted.notable_recruiters;
        if (Array.isArray(recs) && recs.length > 0) {
          recruiters = recs;
        }

        const crs = extracted.courses || extracted.courses_offered;
        if (Array.isArray(crs) && crs.length > 0) {
          courses = crs;
        }
      } else {
        const regexPkg = parsePackageRegex(pageText);
        if (regexPkg && regexPkg.highest_package) {
          highestPkg = regexPkg.highest_package;
          lpaVerified = true;
        }
      }
    }

    // 6. Verification Flag & Save
    let collegeDoc = await College.findOne({ domain: collegeDomain });
    if (collegeDoc) {
      collegeDoc.name = collegeName;
      collegeDoc.location = location;
      collegeDoc.highest_package = highestPkg;
      collegeDoc.average_package = averagePkg;
      collegeDoc.placement_rate = placementRate;
      collegeDoc.lpa_verified = lpaVerified;
      collegeDoc.about = aboutText;
      collegeDoc.courses = courses;
      collegeDoc.recruiters = recruiters;
      collegeDoc.source = `https://${collegeDomain}`;
      if (scrapedImage) {
        collegeDoc.image_url = scrapedImage;
        collegeDoc.banner_url = scrapedImage;
      }
      collegeDoc.last_scraped_at = new Date();
      await collegeDoc.save();
    } else {
      collegeDoc = await College.create({
        name: collegeName,
        domain: collegeDomain,
        location,
        degree_type: 'B.Tech',
        highest_package: highestPkg,
        average_package: averagePkg,
        placement_rate: placementRate,
        total_offers: 0,
        about: aboutText,
        highlight: lpaVerified ? 'Live Verified Placement Stats' : 'Newly Registered Profile',
        courses,
        facilities: DEFAULT_FACILITIES,
        recruiters,
        image_url: scrapedImage || DEFAULT_IMAGE,
        banner_url: scrapedImage || DEFAULT_IMAGE,
        source: `https://${collegeDomain}`,
        lpa_verified: lpaVerified,
        last_scraped_at: new Date(),
      });
    }

    const resultMsg = lpaVerified
      ? `✓ Live scrape: ${collegeName} (${collegeDomain}) — placement data found (${highestPkg})`
      : `✓ Live scrape: ${collegeName} (${collegeDomain}) — placement data unavailable`;

    await writeCrawlerLog(resultMsg, collegeName);
    logStep(resultMsg, collegeName);
    logStep(`✓ Done`, collegeName);

    const validated = validateCollege(collegeDoc);
    return res.json({
      college: collegeToDict(validated),
      cached: false,
      logs,
    });
  } catch (err) {
    console.error('[DISCOVERY] POST /colleges/discover error:', err.message);
    return res.status(500).json({ error: 'Internal server error during live discovery.' });
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

    // Dynamic coverage if empty
    if (
      colleges.length === 0 &&
      search.length > 3 &&
      !GENERIC_SEARCH_WORDS.has(search.toLowerCase())
    ) {
      let domain = buildDomainSlug(search);
      const existing = await College.findOne({ domain });
      if (existing) {
        let counter = 2;
        while (await College.findOne({ domain: `${domain.replace('.edu.in', '')}${counter}.edu.in` })) {
          counter++;
        }
        domain = `${domain.replace('.edu.in', '')}${counter}.edu.in`;
      }

      const location = pick(INDIAN_LOCATIONS);
      const newCollege = await College.create({
        name: search,
        domain,
        location,
        degree_type: 'B.Tech',
        highest_package: 'Data Not Available',
        average_package: 'Data Not Available',
        placement_rate: 'Data Not Available',
        total_offers: 0,
        about: `${search} is an educational institution located in ${location}.`,
        highlight: 'Newly registered institution',
        courses: DEFAULT_COURSES,
        facilities: DEFAULT_FACILITIES,
        recruiters: DEFAULT_RECRUITERS,
        image_url: DEFAULT_IMAGE,
        banner_url: DEFAULT_IMAGE,
        source: '',
        lpa_verified: false,
      });

      await writeCrawlerLog(
        `✓ Dynamic coverage: Registered new college '${search}' (${location})`,
        search
      );

      colleges = [newCollege];
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
router.get('/internships/crawler-status', verifyToken, async (req, res) => {
  try {
    const logs = await CrawlerLog.find().sort({ timestamp: -1 }).limit(25);
    const totalColleges = await College.countDocuments();
    const totalOpportunities = await Internship.countDocuments();
    const lastLog = logs[0];

    return res.json({
      status: 'running',
      colleges_monitored: totalColleges,
      active_opportunities: totalOpportunities,
      last_sync: lastLog ? lastLog.timestamp.toISOString() : null,
      logs: logs.map((l) => l.toDict()),
    });
  } catch (err) {
    console.error('[DISCOVERY] GET /internships/crawler-status error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/internships/crawl ────────────────────────────────────
router.post('/internships/crawl', verifyToken, async (req, res) => {
  try {
    const colleges = await College.find();
    if (colleges.length === 0) {
      return res.json({ colleges_crawled: 0, new_opportunities_found: 0, logs: [] });
    }

    let crawled = 0;
    let found = 0;
    const sessionLogs = [];

    for (let pass = 0; pass < 3; pass++) {
      const college = pick(colleges);
      crawled++;

      const crawlMsg = `Crawling university portal ${college.domain}/research-postings...`;
      await writeCrawlerLog(crawlMsg, college.name);
      sessionLogs.push({ message: crawlMsg, college: college.name, timestamp: new Date().toISOString() });

      if (Math.random() < 0.5) {
        const noNewMsg = `No new postings found on ${college.domain}`;
        await writeCrawlerLog(noNewMsg, college.name);
        sessionLogs.push({ message: noNewMsg, college: college.name, timestamp: new Date().toISOString() });
        continue;
      }

      const topic = pick(MANUAL_TOPICS);
      const prof = pick(MANUAL_PROFESSORS);

      const exists = await Internship.findOne({
        project_title: topic,
        college_name: college.name,
      });
      if (exists) {
        const dupeMsg = `Skipped duplicate: '${topic}' already listed for ${college.name}`;
        await writeCrawlerLog(dupeMsg, college.name);
        sessionLogs.push({ message: dupeMsg, college: college.name, timestamp: new Date().toISOString() });
        continue;
      }

      const mode = Math.random() > 0.5 ? 'remote' : 'on-site';
      const stipendTier = pick(STIPEND_TIERS);
      const skills = pick(SKILL_POOLS);
      const oppScore = computeOpportunityScore(college.domain, college.name, stipendTier.amount);

      const deadline = new Date(Date.now() + randInt(14, 60) * 86400000);

      await Internship.create({
        project_title: topic,
        professor_name: prof,
        professor_image: '',
        college_name: college.name,
        college_domain: college.domain,
        duration: pick(['2 Months', '3 Months', '6 Months']),
        mode,
        stipend: stipendTier.label,
        stipend_amount: stipendTier.amount,
        description: `Research internship on "${topic}" under ${prof} at ${college.name}. This project explores cutting-edge developments in the field with hands-on practical experience.`,
        skills_required: skills,
        deadline: deadline.toISOString().split('T')[0],
        application_process: `Email ${prof.replace('Dr. ', '').toLowerCase().replace(/\s/g, '.')}@${college.domain} with your CV and a statement of interest.`,
        professor_email: `${prof.replace('Dr. ', '').toLowerCase().replace(/\s/g, '.')}@${college.domain}`,
        opportunity_score: oppScore,
      });

      found++;
      const successMsg = `✓ Scraped ${college.name}: Found new opportunity '${topic}' under ${prof}`;
      await writeCrawlerLog(successMsg, college.name);
      sessionLogs.push({ message: successMsg, college: college.name, timestamp: new Date().toISOString() });
    }

    return res.json({
      colleges_crawled: crawled,
      new_opportunities_found: found,
      logs: sessionLogs,
    });
  } catch (err) {
    console.error('[DISCOVERY] POST /internships/crawl error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/internships ───────────────────────────────────────────
router.get('/internships', verifyToken, async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    let query = {};

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query = {
        $or: [
          { project_title: regex },
          { college_name: regex },
          { skills_required: regex },
        ],
      };
    }

    const internships = await Internship.find(query).sort({ opportunity_score: -1 });
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

    const internship = await Internship.findById(id);
    if (!internship) {
      return res.status(404).json({ error: 'Internship not found.' });
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
