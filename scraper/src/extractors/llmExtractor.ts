/**
 * extractors/llmExtractor.ts
 *
 * Gemini LLM extraction — ONLY used when rule-based extraction fails.
 * Never sent whole pages — only relevant text snippets.
 * Never fills missing fields from general knowledge — missing = null.
 * Caches output keyed by content hash.
 */

import { createLogger } from '../utils/logger.js';
import { LLMPlacementResponseSchema, type LLMPlacementResponse } from '../validators/schemas.js';

const log = createLogger('LLM-EXTRACTOR');

// ── In-memory LLM cache (keyed by content hash) ──────────────────────────────

const llmCache = new Map<string, LLMPlacementResponse>();

/**
 * Extract placement data from a text snippet using Gemini.
 * Returns null if extraction fails.
 *
 * @param textSnippet - Relevant text (NOT the whole page — max ~3000 chars)
 * @param collegeName - College name for context
 * @param contentHash - SHA-256 hash for caching
 * @param apiKey - Gemini API key
 * @param model - Gemini model name
 */
export async function extractPlacementWithLLM(
  textSnippet: string,
  collegeName: string,
  contentHash: string,
  apiKey: string,
  model: string,
): Promise<LLMPlacementResponse | null> {
  // Cache check
  const cached = llmCache.get(contentHash);
  if (cached) {
    log.info(`Cache hit for content hash ${contentHash.slice(0, 12)}...`);
    return cached;
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });

    const prompt = buildPlacementPrompt(textSnippet, collegeName);

    const result = await genModel.generateContent(prompt);
    let textResp = result.response.text().trim();

    // Strip markdown code fences if present
    if (textResp.startsWith('```json')) textResp = textResp.slice(7);
    if (textResp.startsWith('```')) textResp = textResp.slice(3);
    if (textResp.endsWith('```')) textResp = textResp.slice(0, -3);

    const rawParsed = JSON.parse(textResp.trim());

    // Validate against schema
    const validated = LLMPlacementResponseSchema.safeParse(rawParsed);
    if (!validated.success) {
      log.warn(`LLM response failed schema validation: ${validated.error.message}`);
      return null;
    }

    // Cache the result
    llmCache.set(contentHash, validated.data);

    // Prevent cache from growing unbounded
    if (llmCache.size > 1000) {
      const firstKey = llmCache.keys().next().value;
      if (firstKey) llmCache.delete(firstKey);
    }

    return validated.data;
  } catch (err) {
    log.error(`LLM extraction failed for ${collegeName}: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Build the extraction prompt for Gemini.
 * Strict rules: never guess, never infer, missing = null.
 */
function buildPlacementPrompt(textSnippet: string, collegeName: string): string {
  return `You are a strict information extraction engine.
Your ONLY task is to extract placement/recruitment facts that are EXPLICITLY written in the text below for "${collegeName}".

ABSOLUTE RULES:
1. NEVER guess, estimate, or infer.
2. NEVER use outside knowledge or general facts about this institution.
3. If something is not explicitly stated in the text, return null for that field.
4. Preserve numbers exactly as written.
5. Preserve recruiter names exactly as written.
6. Output ONLY valid JSON matching this exact structure:

{
  "batch_year": string|null,
  "highest_package_lpa": number|null,
  "highest_package_raw": string|null,
  "average_package_lpa": number|null,
  "average_package_raw": string|null,
  "median_package_lpa": number|null,
  "placement_rate_pct": number|null,
  "total_offers": number|null,
  "total_eligible": number|null,
  "recruiters": string[],
  "top_recruiters": string[],
  "companies_count": number|null,
  "placement_report_url": string|null,
  "_confidence": number
}

FIELD RULES:
- *_lpa fields: value in Lakhs Per Annum (e.g., "₹44 LPA" → 44, "₹8,50,000" → 8.5, "1.2 Cr" → 120)
- *_raw fields: the original text string exactly as it appears
- placement_rate_pct: percentage 0-100
- _confidence: your confidence 0.0-1.0 that the data is correctly extracted from THIS text

Text to extract from:
"${textSnippet.slice(0, 3000)}"`;
}
