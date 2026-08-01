/**
 * models/ScrapeLog.js
 *
 * Structured log entries from the real college scraper pipeline.
 *
 * Intentionally separate from CrawlerLog.js (which is used by the
 * simulated internship daemon and has a 100-entry pruning cap).
 * ScrapeLog is append-only with index-based querying.
 */

import mongoose from 'mongoose';

const scrapeLogSchema = new mongoose.Schema(
  {
    /** Reference to the College document being scraped */
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', index: true },
    collegeName: { type: String, maxlength: 200 },
    collegeDomain: { type: String, maxlength: 100 },

    /** Which data category this log entry relates to */
    category: {
      type: String,
      enum: ['placements', 'admissions', 'basicInfo', 'academics', 'system'],
      default: 'system',
    },

    /** Log severity */
    level: {
      type: String,
      enum: ['info', 'warn', 'error'],
      default: 'info',
    },

    /** Human-readable message */
    message: { type: String, required: true },

    /** BullMQ job ID (null for runOnce.js direct runs) */
    jobId: { type: String, default: null },

    /** Confidence score at time of this log (0–1) */
    confidenceScore: { type: Number, min: 0, max: 1, default: null },

    /** URL that was fetched when this log was emitted */
    sourceUrl: { type: String, default: null },

    /** Any extra structured context (error stack, partial data, etc.) */
    meta: { type: mongoose.Schema.Types.Mixed, default: null },

    timestamp: { type: Date, default: Date.now, index: true },
  },
  { strict: false }
);

// Compound index for the admin dashboard query pattern:
// "show me all logs for college X ordered by newest first"
scrapeLogSchema.index({ collegeId: 1, timestamp: -1 });
scrapeLogSchema.index({ level: 1, timestamp: -1 });

scrapeLogSchema.methods.toDict = function () {
  return {
    id: this._id.toString(),
    collegeId: this.collegeId?.toString(),
    collegeName: this.collegeName,
    collegeDomain: this.collegeDomain,
    category: this.category,
    level: this.level,
    message: this.message,
    jobId: this.jobId,
    confidenceScore: this.confidenceScore,
    sourceUrl: this.sourceUrl,
    meta: this.meta,
    timestamp: this.timestamp?.toISOString(),
  };
};

const ScrapeLog = mongoose.model('ScrapeLog', scrapeLogSchema, 'scrape_logs');
export default ScrapeLog;
