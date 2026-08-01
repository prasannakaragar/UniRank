/**
 * utils/crawler.js — UniRank
 * Background simulated crawler daemon.
 * Runs in a loop after server boot, picking random colleges and
 * generating internship opportunities with realistic delays.
 *
 * Uses a SEPARATE topic pool from the manual trigger endpoint
 * so ambient and manual crawls produce distinct content.
 */

import { College, Internship, CrawlerLog } from '../models/index.js';

// ── Background crawler topic pool (larger & distinct from manual pool) ──

const BG_TOPICS = [
  'Deep Reinforcement Learning for Game Agents',
  'Sustainable Energy Grid Optimization',
  'Multi-Modal Transformer Architectures',
  'Adversarial Robustness in Neural Networks',
  'Swarm Intelligence for Disaster Response',
  'Bioinformatics Pipeline for Genomic Data',
  'Edge Computing for Real-Time Analytics',
  'Zero-Shot Cross-Lingual Transfer Learning',
  'Digital Twin Simulation for Smart Cities',
  'Causal Inference in Observational Data',
  'Neuromorphic Computing Hardware Design',
  'Time-Series Anomaly Detection in IoT',
  'Semantic Segmentation for Autonomous Vehicles',
  'Knowledge Graph Construction from Text',
  'Differentially Private Data Analysis',
  'Meta-Learning for Few-Shot Classification',
  'Robotic Process Automation with AI',
  'Acoustic Scene Classification with CNNs',
  'Variational Autoencoders for Drug Discovery',
  'Federated Analytics for Mobile Health',
  'Continual Learning without Catastrophic Forgetting',
  'Neural Architecture Search Optimization',
  'Vision Transformers for Remote Sensing',
  'Large Language Model Fine-Tuning Strategies',
  'Multi-Agent Cooperative Navigation',
];

const BG_PROFESSORS = [
  'Dr. Deepak Mishra', 'Dr. Nalini Ravishankar', 'Dr. Abhishek Thakur',
  'Dr. Pooja Agarwal', 'Dr. Suresh Venkataraman', 'Dr. Rina Chakraborty',
  'Dr. Manish Pandey', 'Dr. Geeta Krishnamurthy', 'Dr. Ashok Hegde',
  'Dr. Swathi Rangan', 'Dr. Vivek Malhotra', 'Dr. Jyoti Bhaskar',
  'Dr. Karthik Subramanian', 'Dr. Aditi Goswami', 'Dr. Harsh Vardhan',
];

const BG_STIPEND_TIERS = [
  { label: '₹35,000/month', amount: 35000 },
  { label: '₹30,000/month', amount: 30000 },
  { label: '₹25,000/month', amount: 25000 },
  { label: '₹20,000/month', amount: 20000 },
  { label: '₹15,000/month', amount: 15000 },
  { label: '₹12,000/month', amount: 12000 },
  { label: '₹10,000/month', amount: 10000 },
  { label: '₹8,000/month',  amount: 8000 },
  { label: '₹5,000/month',  amount: 5000 },
  { label: 'Unpaid',         amount: 0 },
];

const BG_SKILL_POOLS = [
  ['Python', 'TensorFlow', 'Keras'],
  ['Python', 'PyTorch', 'CUDA'],
  ['C++', 'Embedded Systems', 'FPGA'],
  ['Python', 'Pandas', 'SQL'],
  ['Rust', 'WebAssembly', 'Systems Programming'],
  ['Python', 'Hugging Face', 'NLP'],
  ['Java', 'Hadoop', 'Spark'],
  ['Python', 'Scikit-learn', 'XGBoost'],
  ['TypeScript', 'Next.js', 'GraphQL'],
  ['Python', 'OpenCV', 'YOLO'],
  ['R', 'Bioconductor', 'Genomics'],
  ['Python', 'Reinforcement Learning', 'OpenAI Gym'],
];

// ── Helpers ────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

// ── Main daemon loop ───────────────────────────────────────────────

async function crawlerLoop() {
  // Wait ~5s so the server is fully up
  await sleep(5000);
  console.log('[CRAWLER] Background aggregation engine started');

  while (true) {
    try {
      const colleges = await College.find();
      if (colleges.length === 0) {
        await sleep(30000);
        continue;
      }

      const college = pick(colleges);

      // Log crawling action
      await writeCrawlerLog(
        `Crawling university portal ${college.domain}/research-postings...`,
        college.name
      );

      // Simulate network latency
      await sleep(2000);

      // ~66% chance of finding something
      if (Math.random() < 0.66) {
        const topic = pick(BG_TOPICS);
        const prof = pick(BG_PROFESSORS);

        // Skip if duplicate
        const exists = await Internship.findOne({
          project_title: topic,
          college_name: college.name,
        });

        if (exists) {
          await writeCrawlerLog(
            `No new postings found on ${college.domain} (already indexed)`,
            college.name
          );
        } else {
          const mode = Math.random() > 0.5 ? 'remote' : 'on-site';
          const stipendTier = pick(BG_STIPEND_TIERS);
          const skills = pick(BG_SKILL_POOLS);
          const oppScore = computeOpportunityScore(college.domain, college.name, stipendTier.amount);
          const deadline = new Date(Date.now() + randInt(14, 60) * 86400000);

          await Internship.create({
            project_title: topic,
            professor_name: prof,
            professor_image: '',
            college_name: college.name,
            college_domain: college.domain,
            duration: pick(['2 Months', '3 Months', '4 Months', '6 Months']),
            mode,
            stipend: stipendTier.label,
            stipend_amount: stipendTier.amount,
            description: `Research internship on "${topic}" under ${prof} at ${college.name}. This opportunity involves cutting-edge research with practical applications and mentorship from experienced faculty.`,
            skills_required: skills,
            deadline: deadline.toISOString().split('T')[0],
            application_process: `Email ${prof.replace('Dr. ', '').toLowerCase().replace(/\s/g, '.')}@${college.domain} with your CV, a brief cover letter, and links to relevant projects.`,
            professor_email: `${prof.replace('Dr. ', '').toLowerCase().replace(/\s/g, '.')}@${college.domain}`,
            opportunity_score: oppScore,
          });

          await writeCrawlerLog(
            `✓ Scraped ${college.name}: Found new opportunity '${topic}' under ${prof}`,
            college.name
          );
        }
      } else {
        await writeCrawlerLog(
          `No new postings found on ${college.domain}`,
          college.name
        );
      }
    } catch (err) {
      console.error('[CRAWLER] Error in background loop:', err.message);
      // Don't let one bad iteration kill the thread
      try {
        await writeCrawlerLog(`⚠ Crawler error: ${err.message}`, 'system');
      } catch {
        // If even logging fails, just continue
      }
    }

    // Sleep ~30s between full cycles
    await sleep(30000);
  }
}

/**
 * Start the background crawler daemon.
 * Call this once after the server is fully booted.
 */
export function startCrawlerDaemon() {
  // Fire-and-forget — runs in background
  crawlerLoop().catch((err) => {
    console.error('[CRAWLER] Daemon crashed fatally:', err.message);
  });
}
