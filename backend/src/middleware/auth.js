/**
 * JWT auth middleware.
 * - Standard Bearer header:  Authorization: Bearer <token>
 * - Query param fallback:    ?token=<token>  (for SSE only, via sseAuth)
 */
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { AuthError, ForbiddenError } from '../utils/errors.js';
import { User } from '../models/User.js';

/**
 * Require a valid access token. Populates req.user.
 */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AuthError('Missing or malformed Authorization header');
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthError('Access token expired');
      }
      throw new AuthError('Invalid access token');
    }

    const user = await User.findById(payload.sub).select('-passwordHash -refreshTokens');
    if (!user) {
      throw new AuthError('User not found');
    }

    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional auth — populates req.user if token is valid, but doesn't fail.
 * Useful for public endpoints that personalize if logged in.
 */
export async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next();

    const payload = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(payload.sub).select('-passwordHash -refreshTokens');
    if (user) req.user = user;
  } catch {
    // ignore — not authenticated
  }
  next();
}

/**
 * SSE auth — validates token from ?token= query param.
 * EventSource API can't set headers, so we allow query param for SSE only.
 */
export async function sseAuth(req, _res, next) {
  try {
    const token = req.query.token;
    if (!token) throw new AuthError('Missing token query param');

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthError('Access token expired');
      }
      throw new AuthError('Invalid access token');
    }

    const user = await User.findById(payload.sub).select('-passwordHash -refreshTokens');
    if (!user) throw new AuthError('User not found');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Require a specific role. e.g. requireRole('admin')
 */
export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user || req.user.role !== role) {
      return next(new ForbiddenError(`Requires ${role} role`));
    }
    next();
  };
}
