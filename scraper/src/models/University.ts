/**
 * models/University.ts
 *
 * Core university/college document.
 * Replaces the old College model for scraped data purposes.
 * Uses the 'universities' collection — separate from the legacy 'colleges' collection
 * which continues to serve the frontend until migration is complete.
 */

import mongoose, { Schema, Document } from 'mongoose';

// ── Types ─────────────────────────────────────────────────────────────────────

export const INSTITUTION_TYPES = [
  'government',
  'government_aided',
  'private',
  'deemed',
  'autonomous',
  'central', // IITs, NITs, etc.
] as const;
export type InstitutionType = typeof INSTITUTION_TYPES[number];

export const SCRAPE_STATUSES = [
  'pending',
  'running',
  'success',
  'partial',
  'failed',
  'blocked',
  'retry',
  'review_required',
] as const;
export type ScrapeStatus = typeof SCRAPE_STATUSES[number];

export interface IUniversity extends Document {
  name: string;
  officialWebsite: string | null;
  websiteVerified: boolean;
  city: string;
  state: string;
  country: string;
  institutionType: InstitutionType;
  affiliatedTo: string | null;
  scrapingAllowed: boolean;

  tier: {
    value: 1 | 2 | 3 | null;
    methodology: string | null;
    lastComputed: Date | null;
    label: 'UNIRANK_DERIVED';
  };

  // Scrape scheduling
  lastChecked: Date | null;
  nextScheduledScrape: Date | null;
  scrapeStatus: ScrapeStatus;

  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const tierSchema = new Schema(
  {
    value: { type: Number, enum: [1, 2, 3, null], default: null },
    methodology: { type: String, default: null },
    lastComputed: { type: Date, default: null },
    label: { type: String, default: 'UNIRANK_DERIVED', enum: ['UNIRANK_DERIVED'] },
  },
  { _id: false }
);

const universitySchema = new Schema<IUniversity>(
  {
    name: { type: String, required: true, maxlength: 300, index: true },
    officialWebsite: { type: String, default: null },
    websiteVerified: { type: Boolean, default: false },
    city: { type: String, required: true, maxlength: 100 },
    state: { type: String, required: true, maxlength: 100, index: true },
    country: { type: String, default: 'India', maxlength: 100 },
    institutionType: {
      type: String,
      enum: INSTITUTION_TYPES,
      default: 'private',
    },
    affiliatedTo: { type: String, default: null, maxlength: 200 },
    scrapingAllowed: { type: Boolean, default: false },

    tier: { type: tierSchema, default: () => ({ value: null, methodology: null, lastComputed: null, label: 'UNIRANK_DERIVED' }) },

    lastChecked: { type: Date, default: null },
    nextScheduledScrape: { type: Date, default: null },
    scrapeStatus: {
      type: String,
      enum: SCRAPE_STATUSES,
      default: 'pending',
    },
  },
  {
    timestamps: true,
    collection: 'universities',
  }
);

// Compound index for finding universities by state + status
universitySchema.index({ state: 1, scrapeStatus: 1 });
// Unique constraint on name + city to prevent duplicates
universitySchema.index({ name: 1, city: 1 }, { unique: true });

export const University = mongoose.models.University ??
  mongoose.model<IUniversity>('University', universitySchema);
