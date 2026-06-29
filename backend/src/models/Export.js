/**
 * Export model — tracks export jobs + file paths.
 */
import mongoose from 'mongoose';

const exportSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  topologyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topology',
    required: true,
  },
  securityProfile: {
    type: String,
    enum: ['none', 'basic', 'enterprise'],
    default: 'enterprise',
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'complete', 'failed'],
    default: 'pending',
    index: true,
  },
  // Output file paths (server-side)
  files: {
    gns3Project: { type: String, default: null },
    configsZip: { type: String, default: null },
    manifest: { type: String, default: null },
    allZip: { type: String, default: null },
  },
  // Final topology dict (with full configs) for inspection
  finalDict: { type: mongoose.Schema.Types.Mixed, default: null },
  // Validation result from GNS3 exporter
  validation: { type: mongoose.Schema.Types.Mixed, default: null },
  // Error info if status === 'failed'
  error: { type: String, default: null },
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
});

export const ExportJob = mongoose.model('Export', exportSchema);
export default ExportJob;
