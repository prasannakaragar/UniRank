/**
 * validators/confidenceScorer.ts
 *
 * Computes confidence scores (0.0 – 1.0) per extracted field.
 * Factors: source type, extraction method, data quality.
 */

export interface ConfidenceFactors {
  /** 'official' scores higher than 'third_party' */
  sourceType: 'official' | 'official_pdf' | 'official_report' | 'third_party';
  /** Rule-based extraction is more reliable than LLM */
  extractionMethod: 'rules' | 'llm';
  /** Was this from a structured table or freeform text? */
  structuredData: boolean;
  /** Is this from a PDF or HTML? */
  fromPdf: boolean;
  /** How old is this data? (days since last verified) */
  dataAgeDays: number;
  /** LLM self-reported confidence, if available */
  llmConfidence?: number;
}

/**
 * Compute a confidence score from the given factors.
 */
export function computeConfidence(factors: ConfidenceFactors): number {
  let score = 0.5; // Base score

  // Source type
  switch (factors.sourceType) {
    case 'official': score += 0.20; break;
    case 'official_pdf': score += 0.18; break;
    case 'official_report': score += 0.15; break;
    case 'third_party': score -= 0.15; break;
  }

  // Extraction method
  if (factors.extractionMethod === 'rules') {
    score += 0.15; // Deterministic extraction is more reliable
  } else {
    score += 0.05; // LLM extraction is less reliable
    // Use LLM's self-reported confidence if available
    if (factors.llmConfidence != null) {
      score += (factors.llmConfidence - 0.5) * 0.2; // Adjust by LLM confidence
    }
  }

  // Structured data (tables, etc.)
  if (factors.structuredData) {
    score += 0.10;
  }

  // PDF data tends to be from official reports
  if (factors.fromPdf) {
    score += 0.05;
  }

  // Data age penalty
  if (factors.dataAgeDays > 365) {
    score -= 0.10;
  } else if (factors.dataAgeDays > 180) {
    score -= 0.05;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

/**
 * Determine the review status based on confidence score.
 */
export function shouldRequireReview(confidence: number, threshold = 0.70): boolean {
  return confidence < threshold;
}
