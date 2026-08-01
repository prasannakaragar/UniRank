/**
 * db/ScrapeLog.model.js
 *
 * Scraper-side ScrapeLog model.
 * Writes to the same 'scrape_logs' collection as backend/src/models/ScrapeLog.js.
 */

import mongoose from 'mongoose';

const scrapeLogSchema = new mongoose.Schema(
  {
    collegeId:       { type: mongoose.Schema.Types.ObjectId, ref: 'College', index: true },
    collegeName:     { type: String },
    collegeDomain:   { type: String },
    category:        { type: String, default: 'system' },
    level:           { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    message:         { type: String, required: true },
    jobId:           { type: String, default: null },
    confidenceScore: { type: Number, default: null },
    sourceUrl:       { type: String, default: null },
    meta:            { type: mongoose.Schema.Types.Mixed, default: null },
    timestamp:       { type: Date, default: Date.now, index: true },
  },
  { strict: false }
);

scrapeLogSchema.index({ collegeId: 1, timestamp: -1 });

const ScrapeLog = mongoose.models.ScrapeLog ?? mongoose.model('ScrapeLog', scrapeLogSchema, 'scrape_logs');
export default ScrapeLog;
