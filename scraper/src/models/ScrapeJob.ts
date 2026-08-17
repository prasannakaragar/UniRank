/**
 * models/ScrapeJob.ts
 *
 * Tracks one scrape run per university.
 * One university failing never stops the batch — each has its own job document.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export const JOB_STATUSES = [
  'queued', 'running', 'success', 'partial', 'failed', 'blocked', 'retry', 'review_required',
] as const;
export type JobStatus = typeof JOB_STATUSES[number];

export interface IScrapeJob extends Document {
  universityId: Types.ObjectId;
  status: JobStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  pagesDiscovered: number;
  pagesScraped: number;
  pagesFailed: number;
  dataExtracted: number;
  reviewRequired: number;
  jobErrors: string[];
  triggeredBy: 'schedule' | 'manual' | 'bulk';
  createdAt: Date;
  updatedAt: Date;
}

const scrapeJobSchema = new Schema<IScrapeJob>(
  {
    universityId: { type: Schema.Types.ObjectId, ref: 'University', required: true, index: true },
    status: { type: String, enum: JOB_STATUSES, default: 'queued' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    pagesDiscovered: { type: Number, default: 0 },
    pagesScraped: { type: Number, default: 0 },
    pagesFailed: { type: Number, default: 0 },
    dataExtracted: { type: Number, default: 0 },
    reviewRequired: { type: Number, default: 0 },
    jobErrors: { type: [String], default: [] },
    triggeredBy: { type: String, enum: ['schedule', 'manual', 'bulk'], default: 'manual' },
  },
  {
    timestamps: true,
    collection: 'scrape_jobs',
  }
);

scrapeJobSchema.index({ status: 1, createdAt: -1 });

export const ScrapeJob = mongoose.models.ScrapeJob ??
  mongoose.model<IScrapeJob>('ScrapeJob', scrapeJobSchema);
