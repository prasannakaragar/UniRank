import mongoose from 'mongoose';

// ── Scrape health metadata (per-college) ─────────────────────────────────────
const scrapeMetaSchema = new mongoose.Schema(
  {
    lastScrapedAt: { type: Date, default: null },

    /** Per-category source URLs used for the last scrape */
    sourceUrls: {
      home:       { type: String, default: null },
      placements: { type: String, default: null },
      admissions: { type: String, default: null },
      basicInfo:  { type: String, default: null },
      academics:  { type: String, default: null },
    },

    /** sha256 of raw page text per category — used for change detection */
    contentHash: {
      placements: { type: String, default: null },
      admissions: { type: String, default: null },
      basicInfo:  { type: String, default: null },
      academics:  { type: String, default: null },
    },

    /** 0–1 confidence score (LLM self-reported or field-fill %) */
    confidenceScore: { type: Number, min: 0, max: 1, default: null },

    /** True only after a human admin approves this record */
    verifiedByAdmin: { type: Boolean, default: false },

    /** Scrape pipeline status */
    scrapeStatus: {
      type: String,
      enum: ['success', 'failed', 'needs_review', 'stale', 'pending'],
      default: 'pending',
    },

    /** Which extraction method produced the current data */
    extractionMethod: {
      type: String,
      enum: ['rules', 'llm', null],
      default: null,
    },

    /** Consecutive failure count — used by circuit breaker */
    failureCount: { type: Number, default: 0 },

    /** True when circuit is open (domain temporarily blocked) */
    circuitOpen: { type: Boolean, default: false },

    lastFailureAt: { type: Date, default: null },

    /** Admin's review note (rejection reason, correction comment, etc.) */
    reviewNotes: { type: String, default: null },
  },
  { _id: false }
);

// ── Structured scraped data sub-documents ────────────────────────────────────
// These mirror the Zod schemas in scraper/src/schemas/.
// Stored as Mixed so any shape the LLM returns can be persisted;
// Zod validation happens in the scraper *before* the upsert, so what arrives
// here is already validated. The Mixed type allows future schema additions
// without MongoDB migration.

const collegeSchema = new mongoose.Schema(
  {
    // ── Original flat fields (untouched) ──────────────────────────────────
    name:            { type: String, required: true, maxlength: 200 },
    domain:          { type: String, required: true, unique: true, maxlength: 100 },
    location:        { type: String, maxlength: 200, default: 'India' },
    degree_type:     { type: String, maxlength: 20, default: 'B.Tech' },
    highest_package: { type: String, maxlength: 50, default: 'Data Not Available' },
    average_package: { type: String, maxlength: 50, default: 'Data Not Available' },
    placement_rate:  { type: String, maxlength: 20, default: 'Data Not Available' },
    total_offers:    { type: Number, default: 0 },
    about:           { type: String, default: '' },
    highlight:       { type: String, default: '' },
    courses:         { type: [String], default: [] },
    facilities:      { type: [String], default: [] },
    recruiters:      { type: [String], default: [] },
    campus_details:  { type: String, default: '' },
    image_url:       { type: String, default: '/default-college.jpg' },
    banner_url:      { type: String, default: '/default-college.jpg' },
    source:          { type: String, maxlength: 300, default: '' },
    lpa_verified:    { type: Boolean, default: false },
    last_scraped_at: { type: Date },

    // ── Scraper metadata ──────────────────────────────────────────────────
    scrapeMeta: { type: scrapeMetaSchema, default: () => ({}) },

    // ── Structured scraped data (populated by the scraper pipeline) ───────
    // Stored as mongoose.Schema.Types.Mixed for flexibility.
    scrapedData: {
      placements: { type: mongoose.Schema.Types.Mixed, default: null },
      admissions:  { type: mongoose.Schema.Types.Mixed, default: null },
      basicInfo:   { type: mongoose.Schema.Types.Mixed, default: null },
      academics:   { type: mongoose.Schema.Types.Mixed, default: null },
    },

    // ── Tier classification ───────────────────────────────────────────────
    tier: { type: Number, enum: [1, 2, 3], default: 3 },
    collegeType: {
      type: String,
      enum: ['IIT', 'NIT', 'IISER', 'IIIT', 'deemed', 'private', 'state', 'autonomous'],
      default: 'private',
    },
  },
  { strict: false }
);

collegeSchema.methods.toDict = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    domain: this.domain,
    location: this.location,
    degree_type: this.degree_type || 'B.Tech',
    highest_package: this.highest_package,
    average_package: this.average_package,
    placement_rate: this.placement_rate,
    total_offers: this.total_offers,
    about: this.about,
    highlight: this.highlight,
    courses: this.courses,
    facilities: this.facilities,
    recruiters: this.recruiters,
    campus_details: this.campus_details,
    image_url: this.image_url || '/default-college.jpg',
    banner_url: this.banner_url || '/default-college.jpg',
    source: this.source || '',
    lpa_verified: this.lpa_verified ?? false,
    last_scraped_at: this.last_scraped_at ? this.last_scraped_at.toISOString() : null,
  };
};

const College = mongoose.model('College', collegeSchema, 'colleges');
export default College;
