import mongoose from 'mongoose';

const crawlerLogSchema = new mongoose.Schema(
  {
    message:   { type: String, required: true },
    college:   { type: String, maxlength: 200, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { strict: false }
);

crawlerLogSchema.index({ timestamp: -1 });

crawlerLogSchema.methods.toDict = function () {
  return {
    id: this._id.toString(),
    message: this.message,
    college: this.college,
    timestamp: this.timestamp.toISOString(),
  };
};

const CrawlerLog = mongoose.model('CrawlerLog', crawlerLogSchema, 'crawler_logs');
export default CrawlerLog;
