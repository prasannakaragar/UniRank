/**
 * db/College.model.js
 *
 * Scraper-side College model.
 * Intentionally minimal — only defines the fields the scraper reads/writes.
 * The full schema lives in backend/src/models/College.js.
 * Both connect to the same 'colleges' collection in MongoDB.
 */

import mongoose from 'mongoose';

const scrapeMetaSchema = new mongoose.Schema(
  {
    lastScrapedAt: { type: Date, default: null },
    sourceUrls: {
      home:       { type: String, default: null },
      placements: { type: String, default: null },
      admissions: { type: String, default: null },
      basicInfo:  { type: String, default: null },
      academics:  { type: String, default: null },
    },
    contentHash: {
      placements: { type: String, default: null },
      admissions: { type: String, default: null },
      basicInfo:  { type: String, default: null },
      academics:  { type: String, default: null },
    },
    confidenceScore:   { type: Number, default: null },
    verifiedByAdmin:   { type: Boolean, default: false },
    scrapeStatus:      { type: String, default: 'pending' },
    extractionMethod:  { type: String, default: null },
    failureCount:      { type: Number, default: 0 },
    circuitOpen:       { type: Boolean, default: false },
    lastFailureAt:     { type: Date, default: null },
    reviewNotes:       { type: String, default: null },
  },
  { _id: false }
);

const collegeSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true },
    domain:     { type: String, required: true, unique: true },
    tier:       { type: Number, default: 3 },
    collegeType: { type: String, default: 'private' },
    scrapeMeta: { type: scrapeMetaSchema, default: () => ({}) },
    scrapedData: {
      placements: { type: mongoose.Schema.Types.Mixed, default: null },
      admissions:  { type: mongoose.Schema.Types.Mixed, default: null },
      basicInfo:   { type: mongoose.Schema.Types.Mixed, default: null },
      academics:   { type: mongoose.Schema.Types.Mixed, default: null },
    },
  },
  { strict: false }
);

// Use existing model if already registered (important for hot-reload contexts)
const College = mongoose.models.College ?? mongoose.model('College', collegeSchema, 'colleges');
export default College;
