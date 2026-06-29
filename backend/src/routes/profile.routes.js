/**
 * Profile routes — GNS3 calibration.
 */
import { Router } from 'express';
import { User } from '../models/User.js';
import { validate } from '../middleware/validate.js';
import { profileSchemas } from '../middleware/schemas.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();

// ── GET /api/profile ───────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) throw new NotFoundError('User not found');
    res.json({ profile: user.gns3Profile || { isCalibrated: false } });
  } catch (err) { next(err); }
});

// ── PUT /api/profile ───────────────────────────────────────
router.put('/', requireAuth, validate(profileSchemas.update), async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) throw new NotFoundError('User not found');

    if (req.body.gns3Server) {
      user.gns3Profile.server = req.body.gns3Server;
    }
    if (req.body.imageMap) {
      user.gns3Profile.imageMap = new Map(Object.entries(req.body.imageMap));
    }
    user.gns3Profile.isCalibrated = !!(user.gns3Profile.server?.host || user.gns3Profile.imageMap.size);
    user.gns3Profile.updatedAt = new Date();
    await user.save();

    res.json({ profile: user.gns3Profile });
  } catch (err) { next(err); }
});

// ── POST /api/profile/test-connection ──────────────────────
router.post('/test-connection', requireAuth, validate(profileSchemas.testConnection), async (req, res, next) => {
  try {
    const { host, port } = req.body;
    // Simple TCP reachability check using fetch (GNS3 server exposes HTTP API)
    const controller = globalThis.fetch ? globalThis.fetch : (await import('node-fetch')).default;
    try {
      const url = `http://${host}:${port}/v2/version`;
      const r = await controller(url, { signal: AbortSignal.timeout(3000) });
      const data = await r.json();
      res.json({ reachable: true, version: data.version || 'unknown' });
    } catch (err) {
      res.json({ reachable: false, error: err.message });
    }
  } catch (err) { next(err); }
});

export default router;
