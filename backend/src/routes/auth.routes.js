/**
 * Auth routes — register, login, refresh, me, logout.
 */
import { Router } from 'express';
import * as authService from '../services/auth.service.js';
import { validate } from '../middleware/validate.js';
import { authSchemas } from '../middleware/schemas.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── POST /api/auth/register ────────────────────────────────
router.post('/register',
  validate(authSchemas.register),
  async (req, res, next) => {
    try {
      const { user, accessToken, refreshToken } = await authService.register(req.body);
      res.status(201).json({ user, accessToken, refreshToken });
    } catch (err) { next(err); }
  }
);

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login',
  validate(authSchemas.login),
  async (req, res, next) => {
    try {
      const userAgent = req.headers['user-agent'] || '';
      const { user, accessToken, refreshToken } = await authService.login({
        ...req.body,
        userAgent,
      });
      res.json({ user, accessToken, refreshToken });
    } catch (err) { next(err); }
  }
);

// ── POST /api/auth/refresh ─────────────────────────────────
router.post('/refresh',
  validate(authSchemas.refresh),
  async (req, res, next) => {
    try {
      const { user, accessToken, refreshToken } = await authService.refresh(req.body);
      res.json({ user, accessToken, refreshToken });
    } catch (err) { next(err); }
  }
);

// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me',
  requireAuth,
  async (req, res, next) => {
    try {
      const { user } = await authService.getMe(req.user._id);
      res.json({ user });
    } catch (err) { next(err); }
  }
);

// ── POST /api/auth/logout ──────────────────────────────────
router.post('/logout',
  requireAuth,
  validate(authSchemas.logout),
  async (req, res, next) => {
    try {
      await authService.logout(req.body);
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

export default router;
