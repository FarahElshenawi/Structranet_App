/**
 * User model — auth + profile + GNS3 calibration.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [80, 'Name must be at most 80 characters'],
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  // Refresh tokens — stored hashed so DB leak doesn't grant access
  refreshTokens: [{
    tokenHash: String,
    issuedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    userAgent: String,
    _id: false,
  }],
  // GNS3 calibration (saved during onboarding popup)
  gns3Profile: {
    isCalibrated: { type: Boolean, default: false },
    server: {
      host: { type: String, default: null },
      port: { type: Number, default: null },
    },
    imageMap: { type: Map, of: String, default: {} },  // templateName → image filename
    updatedAt: { type: Date, default: null },
  },
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret) {
      delete ret.passwordHash;
      delete ret.refreshTokens;
      delete ret.__v;
      return ret;
    },
  },
});

// ── Password hashing ────────────────────────────────────────
userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 12);
};

userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// ── Refresh token management (hashed) ───────────────────────
userSchema.methods.issueRefreshToken = function (userAgent = '') {
  const raw = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  this.refreshTokens.push({ tokenHash, expiresAt, userAgent });
  return { raw, expiresAt };
};

userSchema.methods.verifyRefreshToken = function (raw) {
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  return this.refreshTokens.find(
    t => t.tokenHash === tokenHash && t.expiresAt > new Date()
  );
};

userSchema.methods.revokeRefreshToken = function (raw) {
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  this.refreshTokens = this.refreshTokens.filter(t => t.tokenHash !== tokenHash);
};

userSchema.methods.revokeAllRefreshTokens = function () {
  this.refreshTokens = [];
};

// ── Prune expired tokens on save ────────────────────────────
userSchema.pre('save', function (next) {
  if (this.isModified('refreshTokens')) {
    const now = new Date();
    this.refreshTokens = this.refreshTokens.filter(t => t.expiresAt > now);
  }
  next();
});

export const User = mongoose.model('User', userSchema);
export default User;
