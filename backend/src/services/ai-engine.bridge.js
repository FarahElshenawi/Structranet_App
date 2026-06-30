/**
 * AI Engine Bridge — spawns Python wrapper via child_process.
 * Parses stdout line-by-line for EVENT:/RESULT: protocol.
 *
 * Event forwarding: each EVENT: line is forwarded to the onEvent callback
 * (typically wired to SSE broadcast).
 *
 * Final result: the RESULT: line is parsed as JSON and resolved by the Promise.
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { EngineError } from '../utils/errors.js';

class AIEngineBridge {
  constructor() {
    this.pythonBin = config.aiEngine.pythonBin;
    this.wrapperPath = config.aiEngine.wrapperPath;
    this.defaultTimeout = config.aiEngine.defaultTimeout;
    this.exportTimeout = config.aiEngine.exportTimeout;
  }

  /**
   * Verify wrapper exists at startup (called once from server.js).
   */
  async verifyWrapper() {
    try {
      await fs.access(this.wrapperPath);
      logger.info(`AI Engine wrapper: ${this.wrapperPath}`);
    } catch {
      logger.error(`❌ Wrapper not found at: ${this.wrapperPath}`);
      logger.error('   Set WRAPPER_PATH in .env to the absolute path of wrapper.py');
    }
  }

  /**
   * Ensure output directory exists; returns absolute path.
   */
  async ensureOutputDir(outputDir) {
    const dir = outputDir || path.resolve(process.cwd(), config.aiEngine.outputDir);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  /**
   * Core: spawn Python and parse EVENT:/RESULT: stdout lines.
   * @param {string[]} args — CLI args (without python/wrapper.py)
   * @param {number} timeout — ms
   * @param {(event: {event:string, data:any}) => void} onEvent — callback
   * @returns {Promise<object>} — parsed RESULT: JSON
   */
  _spawn(args, timeout = this.defaultTimeout, onEvent = null) {
    return new Promise((resolve, reject) => {
      const fullArgs = [this.wrapperPath, ...args];
      logger.debug(`spawn: ${this.pythonBin} ${fullArgs.join(' ')}`);

      const proc = spawn(this.pythonBin, fullArgs, {
        cwd: path.dirname(this.wrapperPath),
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        windowsHide: true,
      });

      let resultJson = '';
      let stderrBuf = '';
      let lineBuffer = '';
      let timedOut = false;
      let resolved = false;

      const timer = setTimeout(() => {
        timedOut = true;
        try { proc.kill('SIGTERM'); } catch {}
        // Force kill after 5s
        setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 5000);
      }, timeout);

      // ── stdout: line-by-line parser ──────────────────────────
      proc.stdout.on('data', (chunk) => {
        lineBuffer += chunk.toString();
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop(); // keep partial line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('EVENT:')) {
            try {
              const event = JSON.parse(trimmed.slice(6));
              logger.debug(`[event] ${event.event}`, event.data || '');
              if (onEvent) onEvent(event);
            } catch (err) {
              logger.warn('Failed to parse EVENT: line:', trimmed.slice(0, 200));
            }
          } else if (trimmed.startsWith('RESULT:')) {
            resultJson = trimmed.slice(7);
            // Don't resolve yet — wait for process to exit cleanly
          } else {
            // Other stdout lines — ignore (debug noise from Python)
            logger.debug(`[wrapper stdout] ${trimmed}`);
          }
        }
      });

      // ── stderr: capture for error reporting ──────────────────
      proc.stderr.on('data', (chunk) => {
        stderrBuf += chunk.toString();
        // Log to debug so we can see Python warnings/errors
        const text = chunk.toString();
        if (text.trim()) logger.debug(`[wrapper stderr] ${text.trim()}`);
      });

      // ── close: resolve or reject ─────────────────────────────
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (resolved) return;
        resolved = true;

        if (timedOut) {
          return reject(new EngineError(`AI engine timed out after ${timeout / 1000}s`));
        }
        if (code !== 0) {
          // Try to parse stderr as JSON error
          let errMsg = `AI engine exited with code ${code}`;
          try {
            const errJson = JSON.parse(stderrBuf.trim().split('\n').pop());
            if (errJson.error) errMsg = errJson.error;
          } catch { /* ignore */ }
          return reject(new EngineError(errMsg, { stderr: stderrBuf.slice(-2000) }));
        }
        if (!resultJson) {
          // Fallback: try parsing entire stdout as JSON (backward compat)
          const allStdout = lineBuffer; // remaining buffer
          if (allStdout.trim().startsWith('{')) {
            try {
              return resolve(JSON.parse(allStdout));
            } catch { /* fall through */ }
          }
          return reject(new EngineError('No RESULT: line found in AI engine output', { stderr: stderrBuf.slice(-2000) }));
        }
        try {
          const result = JSON.parse(resultJson);
          if (result.success === false) {
            return reject(new EngineError(result.error || 'AI engine reported failure', result));
          }
          resolve(result);
        } catch (err) {
          reject(new EngineError(`Failed to parse RESULT: JSON: ${err.message}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        if (resolved) return;
        resolved = true;
        reject(new EngineError(`Failed to spawn Python: ${err.message}`));
      });
    });
  }

  // ── Command wrappers ───────────────────────────────────────

  /**
   * generate — Phase 1: build topology from natural language.
   *
   * The optional `profile` object carries the user's GNS3 calibration
   * (template_image_map, gns3_version, feature flags) so Python can
   * emit image filenames that match the user's installed images.
   */
  async generate(params, onEvent = null) {
    const args = ['generate', '--request', params.request];
    if (params.securityProfile) args.push('--security-profile', params.securityProfile);
    if (params.outputDir) args.push('--output-dir', params.outputDir);
    if (params.chatHistory) args.push('--chat-history', JSON.stringify(params.chatHistory));
    if (params.profile) args.push('--profile', JSON.stringify(params.profile));
    return this._spawn(args, this.defaultTimeout, onEvent);
  }

  /**
   * edit — Phase 1 (edit): modify existing topology with feedback.
   *
   * The optional `profile` object carries the user's GNS3 calibration
   * (template_image_map) so regenerated topologies use the user's images.
   */
  async edit(params, onEvent = null) {
    const args = ['edit', '--feedback', params.feedback, '--topology', params.topologyPath];
    if (params.securityProfile) args.push('--security-profile', params.securityProfile);
    if (params.originalRequest) args.push('--original-request', params.originalRequest);
    if (params.outputDir) args.push('--output-dir', params.outputDir);
    if (params.chatHistory) args.push('--chat-history', JSON.stringify(params.chatHistory));
    if (params.profile) args.push('--profile', JSON.stringify(params.profile));
    return this._spawn(args, this.defaultTimeout, onEvent);
  }

  /**
   * export — Phase 2: generate configs + .gns3project file.
   *
   * The optional `profile` object carries the user's GNS3 calibration
   * (template_image_map) so exported projects reference the user's images.
   */
  async exportProject(params, onEvent = null) {
    const args = ['export', '--topology', params.topologyPath];
    if (params.securityProfile) args.push('--security-profile', params.securityProfile);
    if (params.outputDir) args.push('--output-dir', params.outputDir);
    if (params.profile) args.push('--profile', JSON.stringify(params.profile));
    return this._spawn(args, this.exportTimeout, onEvent);
  }

  /**
   * qa — answer a Cisco/networking question.
   */
  async qa(topic, onEvent = null) {
    const args = ['qa', '--topic', topic];
    return this._spawn(args, this.defaultTimeout, onEvent);
  }

  /**
   * validate — validate a topology JSON file.
   */
  async validate(topologyPath, onEvent = null) {
    const args = ['validate', '--topology', topologyPath];
    return this._spawn(args, 60_000, onEvent);
  }

  /**
   * catalog — export the appliance catalog as JSON.
   *
   * Returns the full APPLIANCE_CATALOG from Python (the single source of
   * truth) so the frontend can render a searchable device dropdown in the
   * GNS3 profile onboarding popup. Each entry includes template name,
   * node_type, platform, category, default_image, and additional_images.
   */
  async catalog() {
    const args = ['catalog'];
    return this._spawn(args, 30_000, null);
  }
}

// Singleton
const aiEngine = new AIEngineBridge();
export default aiEngine;
