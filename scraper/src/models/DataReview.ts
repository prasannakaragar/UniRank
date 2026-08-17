/**
 * models/DataReview.ts
 *
 * Admin review queue.
 * Low-confidence extractions land here for manual approve/reject/edit.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'edited'] as const;
export type ReviewStatus = typeof REVIEW_STATUSES[number];

export interface IDataReview extends Document {
  universityId: Types.ObjectId;
  dataType: 'placement' | 'nirf_ranking' | 'basic_info' | 'internship';
  dataId: Types.ObjectId | null;
  fieldName: string | null;
  extractedValue: unknown;
  confidence: number;
  sourceUrl: string;
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const dataReviewSchema = new Schema<IDataReview>(
  {
    universityId: { type: Schema.Types.ObjectId, ref: 'University', required: true, index: true },
    dataType: { type: String, enum: ['placement', 'nirf_ranking', 'basic_info', 'internship'], required: true },
    dataId: { type: Schema.Types.ObjectId, default: null },
    fieldName: { type: String, default: null },
    extractedValue: { type: Schema.Types.Mixed, default: null },
    confidence: { type: Number, min: 0, max: 1, required: true },
    sourceUrl: { type: String, required: true },
    status: { type: String, enum: REVIEW_STATUSES, default: 'pending' },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'data_reviews',
  }
);

dataReviewSchema.index({ status: 1, createdAt: -1 });

export const DataReview = mongoose.models.DataReview ??
  mongoose.model<IDataReview>('DataReview', dataReviewSchema);
