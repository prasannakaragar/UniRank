/**
 * models/SourcePage.ts
 *
 * Content-addressable page record.
 * Drives the content-hash caching (§3) and source debugging.
 * Every fetched page is recorded here, keyed by urlHash + contentHash.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISourcePage extends Document {
  universityId: Types.ObjectId;
  url: string;
  urlHash: string;
  contentHash: string;
  fetchedAt: Date;
  method: 'cheerio' | 'playwright';
  httpStatus: number;
  etag: string | null;
  lastModified: string | null;
  extractedDataIds: Types.ObjectId[];
  pageCategory: string;
  createdAt: Date;
}

const sourcePageSchema = new Schema<ISourcePage>(
  {
    universityId: { type: Schema.Types.ObjectId, ref: 'University', required: true, index: true },
    url: { type: String, required: true },
    urlHash: { type: String, required: true, index: true },
    contentHash: { type: String, required: true },
    fetchedAt: { type: Date, required: true },
    method: { type: String, enum: ['cheerio', 'playwright'], required: true },
    httpStatus: { type: Number, required: true },
    etag: { type: String, default: null },
    lastModified: { type: String, default: null },
    /** References to placement/internship/ranking docs this page produced */
    extractedDataIds: { type: [Schema.Types.ObjectId], default: [] },
    /** URL category from relevance scoring: 'placement', 'nirf', 'admission', etc. */
    pageCategory: { type: String, default: 'unknown' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'source_pages',
  }
);

// Find latest page record by URL hash
sourcePageSchema.index({ urlHash: 1, fetchedAt: -1 });
// Content-addressable lookup
sourcePageSchema.index({ universityId: 1, contentHash: 1 });

export const SourcePage = mongoose.models.SourcePage ??
  mongoose.model<ISourcePage>('SourcePage', sourcePageSchema);
