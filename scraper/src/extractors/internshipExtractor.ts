/**
 * extractors/internshipExtractor.ts
 *
 * Scans faculty/staff profiles and research opportunity pages to extract
 * legitimate internship positions (§5).
 *
 * Accuracy rule (§5):
 * A faculty research-area description ("Dr. XYZ researches Computer Vision")
 * is NOT an internship. Only extract when there is explicit evidence an internship/RA position
 * is offered (e.g. "internship opportunity", "project assistant position", "seeking interns", "apply by").
 *
 * Compensation rule (§5):
 * Strictly PAID | UNPAID | NOT_DISCLOSED. Never inferred.
 */

import * as cheerio from 'cheerio';
import { parseIndianAmount } from './indianNumberParser.js';
import { type CompensationStatus } from '../models/Internship.js';

export interface ExtractedInternship {
  facultyName: string;
  facultyProfileUrl: string | null;
  department: string | null;
  projectName: string;
  projectDetails: string;
  compensationStatus: CompensationStatus;
  compensationAmount: number | null;
  compensationRaw: string | null;
  duration: string | null;
  eligibility: string | null;
  applicationUrl: string | null;
  professorEmail: string | null;
  deadline: string | null;
  confidence: number;
}

/** Explicit signals that an actual position/opportunity is offered (not just a research bio) */
const OPPORTUNITY_SIGNALS = [
  /internship\s*(?:opportunity|opening|position|call|program|scheme|announcement)/i,
  /(?:seeking|looking\s*for|inviting\s*applications?\s*for)\s*(?:interns?|research\s*assistants?|project\s*assistants?|fellows?)/i,
  /project\s*(?:assistant|associate|fellow|intern)\s*(?:position|opening|vacancy|call)/i,
  /summer\s*internship/i,
  /winter\s*internship/i,
  /research\s*internship/i,
  /apply\s*(?:by|before|on|here|via)/i,
  /last\s*date\s*to\s*apply/i,
  /stipend\s*[:\-–=]/i,
];

/**
 * Extract internship opportunities from a faculty profile or research opportunity HTML page.
 */
export function extractInternshipsFromPage(html: string, pageUrl: string): ExtractedInternship[] {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe').remove();

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  // Check if page contains explicit opportunity signals
  const hasOpportunitySignal = OPPORTUNITY_SIGNALS.some((sig) => sig.test(bodyText));
  if (!hasOpportunitySignal) {
    return []; // No explicit opportunity offered on this page — skip per §5 rule
  }

  const results: ExtractedInternship[] = [];

  // Extract Faculty Name from headings or profile title
  let facultyName = '';
  const nameMatch = $('h1, h2, .faculty-name, .profile-name, .prof-name').first().text().trim();
  if (/Dr\.|Prof\.|Doctor|Professor/i.test(nameMatch)) {
    facultyName = nameMatch;
  } else {
    const profNameInText = bodyText.match(/(?:Dr\.|Prof\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/);
    if (profNameInText) {
      facultyName = profNameInText[0];
    }
  }

  if (!facultyName) {
    facultyName = 'Faculty Researcher';
  }

  // Extract Department
  let department: string | null = null;
  const deptMatch = bodyText.match(/Department\s*of\s*([A-Za-z\s&]+?)(?:\.|,|\n|\|)/i);
  if (deptMatch) {
    department = `Department of ${deptMatch[1].trim()}`;
  }

  // Extract Email
  let professorEmail: string | null = null;
  const emailMatch = bodyText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    professorEmail = emailMatch[1];
  }

  // Look for specific project/opportunity sections
  $('.opportunity, .opening, .vacancy, .project-item, .internship-item, article, section, p').each((_, el) => {
    const sectionText = $(el).text().replace(/\s+/g, ' ').trim();
    if (sectionText.length < 30) return;

    // Must match at least one explicit opportunity signal in this section
    if (!OPPORTUNITY_SIGNALS.some((sig) => sig.test(sectionText))) return;

    // Extract Project Title
    let projectName = $(el).find('h2, h3, h4, strong, b').first().text().trim();
    if (!projectName || projectName.length < 5) {
      const titleMatch = sectionText.match(/(?:project|title|topic)\s*[:\-–=]?\s*([^.]{10,100})/i);
      projectName = titleMatch ? titleMatch[1].trim() : 'Research Internship Position';
    }

    // Extract Compensation (§5 rule: strictly PAID | UNPAID | NOT_DISCLOSED)
    let compStatus: CompensationStatus = 'NOT_DISCLOSED';
    let compAmount: number | null = null;
    let compRaw: string | null = null;

    if (/unpaid|no\s*stipend|without\s*stipend|honorary/i.test(sectionText)) {
      compStatus = 'UNPAID';
    } else if (/paid|stipend|fellowship|remuneration|financial\s*support|₹|rs\.|lpa/i.test(sectionText)) {
      compStatus = 'PAID';
      const parsedComp = parseIndianAmount(sectionText);
      if (parsedComp) {
        compAmount = parsedComp.value;
        compRaw = parsedComp.raw;
      }
    }

    // Extract Duration
    let duration: string | null = null;
    const durMatch = sectionText.match(/(\d+\s*(?:months?|weeks?|years?))/i);
    if (durMatch) duration = durMatch[1];

    // Extract Deadline
    let deadline: string | null = null;
    const deadMatch = sectionText.match(/(?:deadline|apply\s*by|last\s*date)\s*[:\-–=]?\s*([^.]{5,30})/i);
    if (deadMatch) deadline = deadMatch[1].trim();

    // Application URL
    let applicationUrl: string | null = null;
    const link = $(el).find('a[href]').first().attr('href');
    if (link) {
      try {
        applicationUrl = new URL(link, pageUrl).href;
      } catch {
        // Ignore
      }
    }

    results.push({
      facultyName,
      facultyProfileUrl: pageUrl,
      department,
      projectName: projectName.slice(0, 150),
      projectDetails: sectionText.slice(0, 500),
      compensationStatus: compStatus,
      compensationAmount: compAmount,
      compensationRaw: compRaw,
      duration,
      eligibility: null,
      applicationUrl,
      professorEmail,
      deadline,
      confidence: 0.85,
    });
  });

  return results;
}
