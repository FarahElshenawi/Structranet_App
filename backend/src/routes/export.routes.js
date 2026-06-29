/**
 * Export routes — trigger export, download files.
 */
import { Router } from 'express';
import { ExportJob } from '../models/Export.js';
import { Session } from '../models/Session.js';
import { Topology } from '../models/Topology.js';
import { validate } from '../middleware/validate.js';
import { exportSchemas } from '../middleware/schemas.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger.js';

const execAsync = promisify(exec);
const router = Router();

// ── GET /api/export/:id/status ─────────────────────────────
router.get('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const job = await ExportJob.findById(req.params.id);
    if (!job) throw new NotFoundError('Export job not found');
    if (job.userId.toString() !== req.user._id.toString()) {
      throw new ForbiddenError('Not your export');
    }
    res.json({
      status: job.status,
      files: job.files,
      validation: job.validation,
      error: job.error,
    });
  } catch (err) { next(err); }
});

// ── GET /api/export/:id/download/:file ─────────────────────
// file: 'gns3project' | 'configs' | 'manifest' | 'all'
router.get('/:id/download/:file', requireAuth, async (req, res, next) => {
  try {
    const job = await ExportJob.findById(req.params.id);
    if (!job) throw new NotFoundError('Export job not found');
    if (job.userId.toString() !== req.user._id.toString()) {
      throw new ForbiddenError('Not your export');
    }
    if (job.status !== 'complete') {
      throw new NotFoundError('Export not ready');
    }

    const fileType = req.params.file;

    if (fileType === 'gns3project') {
      const p = job.files.gns3Project;
      if (!p || !fs.existsSync(p)) throw new NotFoundError('GNS3 project file not found');
      return res.download(p, path.basename(p));
    }

    if (fileType === 'configs') {
      // Zip the configs_review directory on the fly
      const dir = job.files.configsZip;
      if (!dir || !fs.existsSync(dir)) throw new NotFoundError('Configs directory not found');
      const zipPath = path.join(path.dirname(dir), `${path.basename(dir)}.zip`);
      try {
        await execAsync(`zip -r "${zipPath}" "${dir}"`, { maxBuffer: 10 * 1024 * 1024 });
      } catch {
        // fallback: use powershell Compress-Archive on Windows or skip
        try {
          await execAsync(`powershell Compress-Archive -Path "${dir}\\*" -DestinationPath "${zipPath}" -Force`);
        } catch (e2) {
          throw new NotFoundError('Failed to create configs.zip');
        }
      }
      return res.download(zipPath, 'configs.zip');
    }

    if (fileType === 'manifest') {
      const p = job.files.manifest;
      if (!p || !fs.existsSync(p)) throw new NotFoundError('Manifest file not found');
      return res.download(p, 'image_manifest.txt');
    }

    if (fileType === 'all') {
      // Bundle everything into a single ZIP
      const bundleDir = path.dirname(job.files.gns3Project || '.');
      const zipPath = path.join(bundleDir, 'deployment_kit.zip');
      try {
        await execAsync(`zip -j "${zipPath}" "${job.files.gns3Project}"`, { maxBuffer: 10 * 1024 * 1024 });
      } catch {
        try {
          await execAsync(`powershell Compress-Archive -Path "${job.files.gns3Project}" -DestinationPath "${zipPath}" -Force`);
        } catch {}
      }
      return res.download(zipPath, 'deployment_kit.zip');
    }

    throw new NotFoundError('Unknown file type');
  } catch (err) { next(err); }
});

export default router;
