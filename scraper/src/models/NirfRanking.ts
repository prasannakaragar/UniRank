/**
 * models/NirfRanking.ts
 *
 * NIRF ranking records — one per university per year per category.
 * Historical: never overwrite, always append.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { SOURCE_TYPES, type SourceType } from './Placement.js';

export interface INirfRanking extends Document {
  universityId: Types.ObjectId;
  rank: number;
  category: string;
  year: number;
  score: number | null;
  source: {
    url: string;
    type: SourceType;
    lastVerified: Date;
  };
  createdAt: Date;
}

const nirfRankingSchema = new Schema<INirfRanking>(
  {
    universityId: { type: Schema.Types.ObjectId, ref: 'University', required: true, index: true },
    rank: { type: Number, required: true },
    category: { type: String, required: true }, // "Engineering", "Overall", "Management", etc.
    year: { type: Number, required: true },
    score: { type: Number, default: null },
    source: {
      url: { type: String, required: true },
      type: { type: String, enum: SOURCE_TYPES, default: 'official' },
      lastVerified: { type: Date, required: true },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'nirf_rankings',
  }
);

// One ranking per university per category per year
nirfRankingSchema.index({ universityId: 1, category: 1, year: 1 }, { unique: true });

export const NirfRanking = mongoose.models.NirfRanking ??
  mongoose.model<INirfRanking>('NirfRanking', nirfRankingSchema);
