/**
 * extractor/llmExtractor.js
 *
 * Gemini-based structured extraction layer.
 *
 * Interface:
 *   extractCategory(pageText, category) → { data, confidenceScore, rawResponse }
 *
 * Design:
 *   - Isolated behind a clean interface — swapping to Claude or another provider
 *     means only replacing the `callLLM` internal function.
 *   - Each category gets its own prompt. Sending all categories at once risks
 *     context length issues and makes partial-failure recovery harder.
 *   - Gemini's `responseMimeType: 'application/json'` enforces JSON output
 *     without needing regex parsing of the response.
 *   - The LLM is asked to self-report a `_confidence` field (0–1). We clamp
 *     this and also derive a fallback confidence from field fill %.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { CATEGORY_REGISTRY } from '../schemas/index.js';

// ── Gemini client (lazily initialised) ────────────────────────────────────────
let genAI = null;
let model = null;

function getModel() {
  if (!model) {
    genAI = new GoogleGenerativeAI(config.geminiApiKey);
    model = genAI.getGenerativeModel({
      model: config.geminiModel,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,    // low temperature = consistent structured output
        topP: 0.8,
        maxOutputTokens: 4096,
      },
    });
  }
  return model;
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(pageText, categoryKey, college) {
  const registry = CATEGORY_REGISTRY[categoryKey];
  if (!registry) throw new Error(`Unknown category: ${categoryKey}`);

  return `You are a precise data extraction assistant for UniRank, an Indian engineering college data platform.

College: ${college.name} (${college.domain})
Category to extract: ${registry.label}

## Page Content
The following is the cleaned text from the college's website:
---
${pageText}
---

## Your Task
${registry.description}

## Additional Requirements
1. Return ONLY valid JSON matching the schema above.
2. After the main data object, add a "_confidence" field (0.0 to 1.0) representing how confident you are in the extracted data. Use:
   - 1.0 = all key fields found and clearly stated
   - 0.8 = most key fields found, some inferred
   - 0.6 = partial data, some fields missing
   - 0.4 = very little data found
   - 0.2 = almost no relevant data on this page
3. If the page clearly does not contain ${registry.label} information, return an object with only default/null values and "_confidence": 0.1
4. DO NOT hallucinate data. If you cannot find a value, return null.
5. Your entire response must be a single JSON object. No markdown, no explanation outside the JSON.

Example response format:
{
  ...fields from the schema...,
  "_confidence": 0.85
}`;
}

// ── LLM call (isolated — swap this function to use Claude/OpenAI) ─────────────

/**
 * @param {string} prompt
 * @returns {Promise<string>} raw JSON string from the model
 */
async function callLLM(prompt) {
  const m = getModel();
  const result = await m.generateContent(prompt);
  return result.response.text();
}

// ── Confidence derivation ─────────────────────────────────────────────────────

/**
 * Derive confidence from what % of non-array top-level fields are non-null.
 * Used as a fallback when the LLM doesn't self-report confidence.
 */
function deriveConfidence(data) {
  if (!data || typeof data !== 'object') return 0;
  const values = Object.values(data).filter((v) => v !== '_confidence');
  if (values.length === 0) return 0;
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  return Math.round((nonNull.length / values.length) * 100) / 100;
}

// ── Main extraction function ──────────────────────────────────────────────────

/**
 * Extract structured data for one category from page text.
 *
 * @param {string} pageText - cleaned plain text from htmlToCleanText()
 * @param {string} categoryKey - 'placements' | 'admissions' | 'basicInfo' | 'academics'
 * @param {{ name: string, domain: string }} college
 * @returns {Promise<{
 *   data: object,            // Zod-validated parsed data
 *   confidenceScore: number, // 0–1
 *   rawResponse: string,     // original LLM response (for debugging)
 *   validationError: string | null, // Zod error message if validation failed
 * }>}
 */
export async function extractCategory(pageText, categoryKey, college) {
  const registry = CATEGORY_REGISTRY[categoryKey];
  if (!registry) throw new Error(`Unknown category: ${categoryKey}`);

  const prompt = buildPrompt(pageText, categoryKey, college);

  let rawResponse = '';
  let parsed = {};
  let confidenceScore = 0;
  let validationError = null;

  try {
    rawResponse = await callLLM(prompt);

    // Parse JSON (handle markdown code fences if model wraps output)
    const jsonText = rawResponse
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    parsed = JSON.parse(jsonText);

    // Extract and remove the meta _confidence field
    const selfReportedConfidence = typeof parsed._confidence === 'number'
      ? Math.max(0, Math.min(1, parsed._confidence))
      : null;
    delete parsed._confidence;

    // Zod validation
    const validation = registry.schema.safeParse(parsed);
    if (validation.success) {
      parsed = validation.data;
      validationError = null;
    } else {
      // Validation failed — keep raw parsed data but flag the error
      validationError = JSON.stringify(validation.error.flatten().fieldErrors);
      console.warn(`[LLM] Zod validation failed for ${college.name}/${categoryKey}:`, validationError);
    }

    // Confidence: prefer LLM self-report, fall back to field-fill %
    confidenceScore = selfReportedConfidence ?? deriveConfidence(parsed);
  } catch (err) {
    validationError = `Parse/LLM error: ${err.message}`;
    confidenceScore = 0;
    console.error(`[LLM] Extraction failed for ${college.name}/${categoryKey}:`, err.message);
    if (config.isDev) {
      console.error('[LLM] Raw response:', rawResponse.slice(0, 500));
    }
  }

  return {
    data: parsed,
    confidenceScore,
    rawResponse,
    validationError,
  };
}

/**
 * Extract multiple categories in sequence (not parallel — preserves rate limits
 * and makes partial failure easier to trace).
 *
 * @param {string} pageText
 * @param {string[]} categories - subset of CATEGORIES
 * @param {{ name: string, domain: string }} college
 * @returns {Promise<Record<string, { data, confidenceScore, rawResponse, validationError }>>}
 */
export async function extractCategories(pageTexts, categories, college) {
  const results = {};
  for (const cat of categories) {
    const text = pageTexts[cat] ?? pageTexts.home ?? '';
    if (!text) {
      results[cat] = { data: {}, confidenceScore: 0, rawResponse: '', validationError: 'No page text available' };
      continue;
    }
    results[cat] = await extractCategory(text, cat, college);
  }
  return results;
}
