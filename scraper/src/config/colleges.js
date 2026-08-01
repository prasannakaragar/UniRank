/**
 * config/colleges.js
 * Seed list of 15 colleges for Phase 1.
 *
 * tier: 1 = IIT/NIT/IISER (hand-tuned rules extractor in Phase 2, LLM for now)
 *        2 = Private Tier-A (LLM)
 *        3 = Private Tier-B / State University (LLM)
 *
 * urls: best-guess starting URLs per category. The crawler may follow links
 * further — these are entry points, not guaranteed exact pages.
 */

export const COLLEGES = [
  // ── Tier 1 — IITs ───────────────────────────────────────────────────────
  {
    name: 'IIT Bombay',
    shortName: 'IITB',
    domain: 'iitb.ac.in',
    tier: 1,
    type: 'IIT',
    state: 'Maharashtra',
    urls: {
      home: 'https://www.iitb.ac.in',
      placements: 'https://www.iitb.ac.in/en/education/placements',
      admissions: 'https://www.iitb.ac.in/en/education/undergraduate-admissions',
    },
  },
  {
    name: 'IIT Madras',
    shortName: 'IITM',
    domain: 'iitm.ac.in',
    tier: 1,
    type: 'IIT',
    state: 'Tamil Nadu',
    urls: {
      home: 'https://www.iitm.ac.in',
      placements: 'https://cdc.iitm.ac.in',
      admissions: 'https://www.iitm.ac.in/content/admissions',
    },
  },
  {
    name: 'IIT Delhi',
    shortName: 'IITD',
    domain: 'iitd.ac.in',
    tier: 1,
    type: 'IIT',
    state: 'Delhi',
    urls: {
      home: 'https://www.iitd.ac.in',
      placements: 'https://home.iitd.ac.in/placements.php',
      admissions: 'https://home.iitd.ac.in/admissions.php',
    },
  },

  // ── Tier 1 — NITs ───────────────────────────────────────────────────────
  {
    name: 'NIT Trichy',
    shortName: 'NITT',
    domain: 'nitt.edu',
    tier: 1,
    type: 'NIT',
    state: 'Tamil Nadu',
    urls: {
      home: 'https://www.nitt.edu',
      placements: 'https://www.nitt.edu/home/students/placementsnew/',
      admissions: 'https://www.nitt.edu/home/academics/admissions/',
    },
  },
  {
    name: 'NIT Karnataka (Surathkal)',
    shortName: 'NITK',
    domain: 'nitk.ac.in',
    tier: 1,
    type: 'NIT',
    state: 'Karnataka',
    urls: {
      home: 'https://www.nitk.ac.in',
      placements: 'https://cdc.nitk.ac.in',
      admissions: 'https://www.nitk.ac.in/admissions',
    },
  },

  // ── Tier 1 — IISERs ─────────────────────────────────────────────────────
  {
    name: 'IISER Pune',
    shortName: 'IISERPUNE',
    domain: 'iiserpune.ac.in',
    tier: 1,
    type: 'IISER',
    state: 'Maharashtra',
    urls: {
      home: 'https://www.iiserpune.ac.in',
      placements: 'https://www.iiserpune.ac.in/placements',
      admissions: 'https://www.iiserpune.ac.in/admissions',
    },
  },
  {
    name: 'IISER Bhopal',
    shortName: 'IISERB',
    domain: 'iiserb.ac.in',
    tier: 1,
    type: 'IISER',
    state: 'Madhya Pradesh',
    urls: {
      home: 'https://www.iiserb.ac.in',
      placements: 'https://www.iiserb.ac.in/placements',
      admissions: 'https://www.iiserb.ac.in/admissions',
    },
  },

  // ── Tier 2 — Private Tier-A ──────────────────────────────────────────────
  {
    name: 'VIT Vellore',
    shortName: 'VIT',
    domain: 'vit.ac.in',
    tier: 2,
    type: 'deemed',
    state: 'Tamil Nadu',
    urls: {
      home: 'https://www.vit.ac.in',
      placements: 'https://www.vit.ac.in/placements',
      admissions: 'https://www.vit.ac.in/admissions',
    },
  },
  {
    name: 'Manipal Institute of Technology',
    shortName: 'MIT Manipal',
    domain: 'manipal.edu',
    tier: 2,
    type: 'deemed',
    state: 'Karnataka',
    urls: {
      home: 'https://manipal.edu/mit.html',
      placements: 'https://manipal.edu/mit/campus-life/placement.html',
      admissions: 'https://manipal.edu/mit/admission.html',
    },
  },
  {
    name: 'BITS Pilani',
    shortName: 'BITS',
    domain: 'bits-pilani.ac.in',
    tier: 2,
    type: 'deemed',
    state: 'Rajasthan',
    urls: {
      home: 'https://www.bits-pilani.ac.in',
      placements: 'https://www.bits-pilani.ac.in/pilani/placements',
      admissions: 'https://www.bits-pilani.ac.in/admissions',
    },
  },
  {
    name: 'Amrita Vishwa Vidyapeetham',
    shortName: 'Amrita',
    domain: 'amrita.edu',
    tier: 2,
    type: 'deemed',
    state: 'Tamil Nadu',
    urls: {
      home: 'https://www.amrita.edu',
      placements: 'https://www.amrita.edu/placements/',
      admissions: 'https://www.amrita.edu/admissions/',
    },
  },
  {
    name: 'SRM Institute of Science and Technology',
    shortName: 'SRM',
    domain: 'srmist.edu.in',
    tier: 2,
    type: 'deemed',
    state: 'Tamil Nadu',
    urls: {
      home: 'https://www.srmist.edu.in',
      placements: 'https://www.srmist.edu.in/placements/',
      admissions: 'https://www.srmist.edu.in/admissions/',
    },
  },

  // ── Tier 3 — Private Tier-B ──────────────────────────────────────────────
  {
    name: 'REVA University',
    shortName: 'REVA',
    domain: 'reva.edu.in',
    tier: 3,
    type: 'private',
    state: 'Karnataka',
    urls: {
      home: 'https://www.reva.edu.in',
      placements: 'https://www.reva.edu.in/placements/',
      admissions: 'https://www.reva.edu.in/admissions/',
    },
  },
  {
    name: 'BMS College of Engineering',
    shortName: 'BMSCE',
    domain: 'bmsce.ac.in',
    tier: 3,
    type: 'private',
    state: 'Karnataka',
    urls: {
      home: 'https://www.bmsce.ac.in',
      placements: 'https://www.bmsce.ac.in/placements',
      admissions: 'https://www.bmsce.ac.in/admissions',
    },
  },
  {
    name: 'RV College of Engineering',
    shortName: 'RVCE',
    domain: 'rvce.edu.in',
    tier: 3,
    type: 'private',
    state: 'Karnataka',
    urls: {
      home: 'https://www.rvce.edu.in',
      placements: 'https://www.rvce.edu.in/placements',
      admissions: 'https://www.rvce.edu.in/admissions',
    },
  },

  // ── Tier 3 — State University (complex structure, good robustness test) ──
  {
    name: 'Anna University',
    shortName: 'Anna',
    domain: 'annauniv.edu',
    tier: 3,
    type: 'state',
    state: 'Tamil Nadu',
    urls: {
      home: 'https://www.annauniv.edu',
      placements: 'https://www.annauniv.edu/placements.php',
      admissions: 'https://www.annauniv.edu/admissions.php',
    },
  },
];

/** Quick lookup by domain */
export function getCollegeByDomain(domain) {
  return COLLEGES.find((c) => c.domain === domain) ?? null;
}

/** Quick lookup by name (case-insensitive partial match) */
export function findCollegeByName(name) {
  const lower = name.toLowerCase();
  return COLLEGES.find(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      c.shortName.toLowerCase().includes(lower)
  ) ?? null;
}
