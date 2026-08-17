/**
 * config/seed/karnataka-engineering.ts
 *
 * Seed list of Karnataka engineering colleges/universities.
 * Assembled from:
 *   - VTU (Visvesvaraya Technological University) affiliated colleges list
 *   - AICTE approved institution data for Karnataka
 *   - KEA (Karnataka Examinations Authority) counselling data
 *
 * Where the official website isn't confidently known, websiteVerified = false.
 * This seed list feeds the crawler queue for the proof-of-concept.
 *
 * Covers ALL tiers and ALL institution types:
 *   - Government engineering colleges
 *   - Government-aided colleges
 *   - Private engineering colleges
 *   - Deemed universities offering engineering
 *   - Autonomous engineering institutions
 *   - Central institutions (NIT)
 */

export interface SeedCollege {
  name: string;
  officialWebsite: string | null;
  websiteVerified: boolean;
  city: string;
  institutionType: 'government' | 'government_aided' | 'private' | 'deemed' | 'autonomous' | 'central';
  affiliatedTo: string | null;
}

export const KARNATAKA_ENGINEERING_COLLEGES: SeedCollege[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CENTRAL INSTITUTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'National Institute of Technology Karnataka, Surathkal',
    officialWebsite: 'https://www.nitk.ac.in',
    websiteVerified: true,
    city: 'Mangalore',
    institutionType: 'central',
    affiliatedTo: null,
  },
  {
    name: 'Indian Institute of Science',
    officialWebsite: 'https://www.iisc.ac.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'central',
    affiliatedTo: null,
  },
  {
    name: 'Indian Institute of Information Technology Dharwad',
    officialWebsite: 'https://www.iiitdwd.ac.in',
    websiteVerified: true,
    city: 'Dharwad',
    institutionType: 'central',
    affiliatedTo: null,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEEMED UNIVERSITIES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Manipal Institute of Technology',
    officialWebsite: 'https://manipal.edu/mit.html',
    websiteVerified: true,
    city: 'Manipal',
    institutionType: 'deemed',
    affiliatedTo: 'Manipal Academy of Higher Education',
  },
  {
    name: 'PES University',
    officialWebsite: 'https://www.pes.edu',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'deemed',
    affiliatedTo: null,
  },
  {
    name: 'M S Ramaiah University of Applied Sciences',
    officialWebsite: 'https://www.msruas.ac.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'deemed',
    affiliatedTo: null,
  },
  {
    name: 'REVA University',
    officialWebsite: 'https://www.reva.edu.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'deemed',
    affiliatedTo: null,
  },
  {
    name: 'Jain University (SET)',
    officialWebsite: 'https://www.jainuniversity.ac.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'deemed',
    affiliatedTo: null,
  },
  {
    name: 'Christ University - Faculty of Engineering',
    officialWebsite: 'https://christuniversity.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'deemed',
    affiliatedTo: null,
  },
  {
    name: 'Alliance University - College of Engineering',
    officialWebsite: 'https://www.alliance.edu.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'deemed',
    affiliatedTo: null,
  },
  {
    name: 'CMR University',
    officialWebsite: 'https://www.cmr.edu.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'deemed',
    affiliatedTo: null,
  },
  {
    name: 'KLE Technological University',
    officialWebsite: 'https://www.kletech.ac.in',
    websiteVerified: true,
    city: 'Hubballi',
    institutionType: 'deemed',
    affiliatedTo: null,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTONOMOUS COLLEGES (VTU-affiliated but autonomous)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'RV College of Engineering',
    officialWebsite: 'https://www.rvce.edu.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'autonomous',
    affiliatedTo: 'VTU',
  },
  {
    name: 'BMS College of Engineering',
    officialWebsite: 'https://www.bmsce.ac.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'autonomous',
    affiliatedTo: 'VTU',
  },
  {
    name: 'M S Ramaiah Institute of Technology',
    officialWebsite: 'https://www.msrit.edu',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'autonomous',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Nitte Meenakshi Institute of Technology',
    officialWebsite: 'https://nmit.ac.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'autonomous',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Siddaganga Institute of Technology',
    officialWebsite: 'https://www.sit.ac.in',
    websiteVerified: true,
    city: 'Tumkur',
    institutionType: 'autonomous',
    affiliatedTo: 'VTU',
  },
  {
    name: 'JSS Science and Technology University',
    officialWebsite: 'https://jssstuniv.in',
    websiteVerified: true,
    city: 'Mysore',
    institutionType: 'autonomous',
    affiliatedTo: null,
  },
  {
    name: 'SDM College of Engineering and Technology',
    officialWebsite: 'https://www.sdmcet.ac.in',
    websiteVerified: true,
    city: 'Dharwad',
    institutionType: 'autonomous',
    affiliatedTo: 'VTU',
  },
  {
    name: 'BMS Institute of Technology and Management',
    officialWebsite: 'https://www.bmsit.ac.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'autonomous',
    affiliatedTo: 'VTU',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOVERNMENT ENGINEERING COLLEGES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'University Visvesvaraya College of Engineering (UVCE)',
    officialWebsite: 'https://uvce.ac.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'government',
    affiliatedTo: 'Bangalore University',
  },
  {
    name: 'The National Institute of Engineering',
    officialWebsite: 'https://www.nie.ac.in',
    websiteVerified: true,
    city: 'Mysore',
    institutionType: 'government_aided',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Government Engineering College, Ramanagara',
    officialWebsite: null,
    websiteVerified: false,
    city: 'Ramanagara',
    institutionType: 'government',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Government Engineering College, Hassan',
    officialWebsite: null,
    websiteVerified: false,
    city: 'Hassan',
    institutionType: 'government',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Government Engineering College, Kushalnagar',
    officialWebsite: null,
    websiteVerified: false,
    city: 'Kushalnagar',
    institutionType: 'government',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Government Engineering College, Haveri',
    officialWebsite: null,
    websiteVerified: false,
    city: 'Haveri',
    institutionType: 'government',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Government Engineering College, Chamarajanagar',
    officialWebsite: null,
    websiteVerified: false,
    city: 'Chamarajanagar',
    institutionType: 'government',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Government Engineering College, Raichur',
    officialWebsite: null,
    websiteVerified: false,
    city: 'Raichur',
    institutionType: 'government',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Government Engineering College, Karwar',
    officialWebsite: null,
    websiteVerified: false,
    city: 'Karwar',
    institutionType: 'government',
    affiliatedTo: 'VTU',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE ENGINEERING COLLEGES (VTU-affiliated)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Dayananda Sagar College of Engineering',
    officialWebsite: 'https://www.dsce.edu.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'New Horizon College of Engineering',
    officialWebsite: 'https://www.newhorizonindia.edu',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Sir M Visvesvaraya Institute of Technology (Sir MVIT)',
    officialWebsite: 'https://www.sirmvit.edu',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Sapthagiri College of Engineering',
    officialWebsite: 'https://www.sapthagiri.edu.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'CMR Institute of Technology',
    officialWebsite: 'https://www.cmrit.ac.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Dr Ambedkar Institute of Technology',
    officialWebsite: 'https://www.drait.edu.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Acharya Institute of Technology',
    officialWebsite: 'https://acharya.ac.in/ait',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Cambridge Institute of Technology',
    officialWebsite: 'https://www.citech.edu.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Presidency University - School of Engineering',
    officialWebsite: 'https://www.presidencyuniversity.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: null,
  },
  {
    name: 'East West Institute of Technology',
    officialWebsite: 'https://www.ewit.edu.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Global Academy of Technology',
    officialWebsite: 'https://www.gat.ac.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Nagarjuna College of Engineering and Technology',
    officialWebsite: 'https://www.ncetbangalore.com',
    websiteVerified: false,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Canara Engineering College',
    officialWebsite: 'https://www.canaraengg.com',
    websiteVerified: false,
    city: 'Mangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Sahyadri College of Engineering and Management',
    officialWebsite: 'https://www.sahyadri.edu.in',
    websiteVerified: true,
    city: 'Mangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'St Joseph Engineering College',
    officialWebsite: 'https://www.sjec.ac.in',
    websiteVerified: true,
    city: 'Mangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'NMAM Institute of Technology',
    officialWebsite: 'https://nmamit.nitte.edu.in',
    websiteVerified: true,
    city: 'Nitte',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Basaveshwar Engineering College',
    officialWebsite: 'https://www.becbgk.edu',
    websiteVerified: true,
    city: 'Bagalkot',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Bapuji Institute of Engineering and Technology',
    officialWebsite: 'https://www.bfriengineeringcollege.org',
    websiteVerified: false,
    city: 'Davangere',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Reva Institute of Technology and Management',
    officialWebsite: 'https://www.revainstitution.org',
    websiteVerified: false,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Bangalore Institute of Technology',
    officialWebsite: 'https://www.bit-bangalore.edu.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'R R Institute of Technology',
    officialWebsite: 'https://www.rfrrit.ac.in',
    websiteVerified: false,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'K S Institute of Technology',
    officialWebsite: 'https://www.ksit.ac.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'BNM Institute of Technology',
    officialWebsite: 'https://www.bnmit.org',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'ACS College of Engineering',
    officialWebsite: 'https://www.acsce.edu.in',
    websiteVerified: true,
    city: 'Bangalore',
    institutionType: 'private',
    affiliatedTo: 'VTU',
  },
  {
    name: 'Sri Jayachamarajendra College of Engineering',
    officialWebsite: 'https://sjce.ac.in',
    websiteVerified: true,
    city: 'Mysore',
    institutionType: 'government_aided',
    affiliatedTo: 'JSS STU',
  },
];

/**
 * Quick stats about the seed list.
 */
export function getSeedStats() {
  const total = KARNATAKA_ENGINEERING_COLLEGES.length;
  const verified = KARNATAKA_ENGINEERING_COLLEGES.filter(c => c.websiteVerified).length;
  const unverified = total - verified;
  const byType: Record<string, number> = {};
  for (const c of KARNATAKA_ENGINEERING_COLLEGES) {
    byType[c.institutionType] = (byType[c.institutionType] || 0) + 1;
  }
  return { total, verified, unverified, byType };
}
