/**
 * models/Placement.ts
 *
 * Historical placement data — one document per university per year.
 * Never overwrites: new years create new documents.
 * Every numeric field carries source tracking and confidence.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Source tracking sub-schema (reused across models) ─────────────────────────

export const SOURCE_TYPES = ['official', 'official_pdf', 'official_report', 'third_party'] as const;
export type SourceType = typeof SOURCE_TYPES[number];

export const VALUE_STATUSES = ['DISCLOSED', 'NOT_DISCLOSED'] as const;
export type ValueStatus = typeof VALUE_STATUSES[number];

export interface ISourcedValue {
  value: number | null;
  currency: string;
  status: ValueStatus;
  raw: string | null;
  source: {
    url: string;
    type: SourceType;
    lastVerified: Date;
  };
  confidence: number;
  extractionMethod: 'rules' | 'llm';
}

const sourcedValueSchema = new Schema(
  {
    value: { type: Number, default: null },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: VALUE_STATUSES, default: 'NOT_DISCLOSED' },
    /** Original string from page, e.g. "₹44 LPA" */
    raw: { type: String, default: null },
    source: {
      url: { type: String, required: true },
      type: { type: String, enum: SOURCE_TYPES, default: 'official' },
      lastVerified: { type: Date, required: true },
    },
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    extractionMethod: { type: String, enum: ['rules', 'llm'], default: 'rules' },
  },
  { _id: false }
);

// ── Placement document ────────────────────────────────────────────────────────

export interface IPlacement extends Document {
  universityId: Types.ObjectId;
  year: string;
  highestPackage: ISourcedValue | null;
  averagePackage: ISourcedValue | null;
  medianPackage: ISourcedValue | null;
  placementRatePct: number | null;
  totalOffers: number | null;
  totalEligibleStudents: number | null;
  recruiters: string[];
  topRecruiters: string[];
  companiesCount: number | null;
  placementReportUrl: string | null;
  overallConfidence: number;
  extractionMethod: 'rules' | 'llm';
  sourceUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const placementSchema = new Schema<IPlacement>(
  {
    universityId: { type: Schema.Types.ObjectId, ref: 'University', required: true, index: true },
    /** Academic year, e.g. "2023-24" */
    year: { type: String, required: true },
    highestPackage: { type: sourcedValueSchema, default: null },
    averagePackage: { type: sourcedValueSchema, default: null },
    medianPackage: { type: sourcedValueSchema, default: null },
    placementRatePct: { type: Number, min: 0, max: 100, default: null },
    totalOffers: { type: Number, default: null },
    totalEligibleStudents: { type: Number, default: null },
    recruiters: { type: [String], default: [] },
    topRecruiters: { type: [String], default: [] },
    companiesCount: { type: Number, default: null },
    placementReportUrl: { type: String, default: null },
    overallConfidence: { type: Number, min: 0, max: 1, default: 0.5 },
    extractionMethod: { type: String, enum: ['rules', 'llm'], default: 'rules' },
    sourceUrl: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'placements',
  }
);

// One placement record per university per year — never duplicate
placementSchema.index({ universityId: 1, year: 1 }, { unique: true });

export const Placement = mongoose.models.Placement ??
  mongoose.model<IPlacement>('Placement', placementSchema);
