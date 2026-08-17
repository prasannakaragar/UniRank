/**
 * models/Internship.ts
 *
 * Source-tracked research internship opportunities extracted from
 * faculty/staff profiles, department research pages, and announcements (§5).
 *
 * Strict Live Verification & Publish Gate Rules:
 * 1. publishStatus: DRAFT | PUBLISHED | DELISTED | EXPIRED (defaults to DRAFT)
 * 2. Everything extracted starts as DRAFT.
 * 3. Only the Verification Service promotes DRAFT -> PUBLISHED after:
 *    - Confirming official source URL is live (HTTP 200)
 *    - Confirming listing text is still present on page
 *    - Confirming deadline has NOT passed
 *    - Confirming extraction confidence >= threshold (or approved by admin)
 * 4. Compensation is strictly: PAID | UNPAID | NOT_DISCLOSED (never inferred).
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { SOURCE_TYPES, type SourceType } from './Placement.js';

export const COMPENSATION_STATUSES = ['PAID', 'UNPAID', 'NOT_DISCLOSED'] as const;
export type CompensationStatus = typeof COMPENSATION_STATUSES[number];

export const PUBLISH_STATUSES = ['DRAFT', 'PUBLISHED', 'DELISTED', 'EXPIRED'] as const;
export type PublishStatus = typeof PUBLISH_STATUSES[number];

export interface ICompensation {
  status: CompensationStatus;
  amount: number | null; // Monthly or total stipend in INR
  currency: string;
  raw: string | null;
}

export interface IInternshipScraped extends Document {
  universityId: Types.ObjectId;
  universityName: string;
  facultyName: string;
  facultyProfileUrl: string | null;
  department: string | null;
  projectName: string;
  projectDetails: string;
  compensation: ICompensation;
  duration: string | null;
  eligibility: string | null;
  applicationUrl: string | null;
  professorEmail: string | null;
  deadline: string | null;
  deadlineDate: Date | null;
  source: {
    url: string;
    type: SourceType;
    lastVerified: Date;
  };
  confidence: number;
  fingerprint: string;

  // Gate & Verification Fields
  publishStatus: PublishStatus;
  lastVerifiedLive: Date | null;
  delistedReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const compensationSchema = new Schema(
  {
    status: { type: String, enum: COMPENSATION_STATUSES, default: 'NOT_DISCLOSED' },
    amount: { type: Number, default: null },
    currency: { type: String, default: 'INR' },
    raw: { type: String, default: null },
  },
  { _id: false }
);

const internshipScrapedSchema = new Schema<IInternshipScraped>(
  {
    universityId: { type: Schema.Types.ObjectId, ref: 'University', required: true, index: true },
    universityName: { type: String, required: true },
    facultyName: { type: String, required: true },
    facultyProfileUrl: { type: String, default: null },
    department: { type: String, default: null },
    projectName: { type: String, required: true },
    projectDetails: { type: String, required: true },
    compensation: { type: compensationSchema, default: () => ({ status: 'NOT_DISCLOSED', amount: null, currency: 'INR', raw: null }) },
    duration: { type: String, default: null },
    eligibility: { type: String, default: null },
    applicationUrl: { type: String, default: null },
    professorEmail: { type: String, default: null },
    deadline: { type: String, default: null },
    deadlineDate: { type: Date, default: null, index: true },
    source: {
      url: { type: String, required: true },
      type: { type: String, enum: SOURCE_TYPES, default: 'official' },
      lastVerified: { type: Date, required: true },
    },
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    fingerprint: { type: String, required: true, unique: true },

    publishStatus: {
      type: String,
      enum: PUBLISH_STATUSES,
      default: 'DRAFT',
      required: true,
      index: true,
    },
    lastVerifiedLive: { type: Date, default: null, index: true },
    delistedReason: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'internships_scraped',
  }
);

internshipScrapedSchema.index({ publishStatus: 1, lastVerifiedLive: -1 });

export const InternshipScraped = mongoose.models.InternshipScraped ??
  mongoose.model<IInternshipScraped>('InternshipScraped', internshipScrapedSchema);
