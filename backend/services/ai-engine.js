/**
 * ai-engine.js — Python wrapper client for StructuraNet AI.
 *
 * Spawns `python wrapper.py <command>` as a child process and returns
 * the parsed JSON result. All communication is via stdout (JSON) and
 * stderr (errors/logs).
 *
 * Usage:
 *   const aiEngine = require('./ai-engine');
 *   const result = await aiEngine.generate({ request: 'campus network', ... });
 *   const edited = await aiEngine.edit({ feedback: 'add a firewall', ... });
 *   const exported = await aiEngine.export({ topology: '/path/to/_topology.json', ... });
 *   const answer = await aiEngine.searchQA({ topic: 'OSPF configuration' });
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ──────────────────────────────────────────────────────────

/**
 * Path to the Python wrapper script.
 * Adjust this if your ai-engine directory is located elsewhere.
 */
const WRAPPER_PATH = process.env.STRUCTRANET_WRAPPER_PATH ||
  path.resolve(__dirname, "../../ai-engine/wrapper.py");

/**
 * Python binary name. Change to "python3" if needed.
 */
const PYTHON_BIN = process.env.STRUCTRANET_PYTHON || "python";

/**
 * Maximum time (ms) to wait for the Python process to complete.
 * Default: 5 minutes (LLM calls can be slow).
 */
const DEFAULT_TIMEOUT = 5 * 60 * 1000;

// ─── Core spawn helper ──────────────────────────────────────────────────────

/**
 * Spawn the Python wrapper and collect its stdout/stderr.
 *
 * @param {string[]} args - CLI arguments for wrapper.py
 * @param {number} [timeout=DEFAULT_TIMEOUT] - Max time in ms
 * @returns {Promise<Object>} - Parsed JSON from stdout
 * @throws {Error} - If the process exits non-zero or times out
 */
function _spawnWrapper(args, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [WRAPPER_PATH, ...args], {
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Timeout guard
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`Python wrapper timed out after ${timeout}ms`));
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        // Try to parse error from stderr
        let errorMessage = `Python wrapper exited with code ${code}`;
        try {
          const errJson = JSON.parse(stderr.trim().split("\n").pop());
          if (errJson.error) {
            errorMessage = errJson.error;
            if (errJson.details) {
              errorMessage += ` — ${errJson.details}`;
            }
          }
        } catch {
          // Not JSON — use raw stderr
          if (stderr.trim()) {
            errorMessage += `: ${stderr.trim().slice(-500)}`;
          }
        }
        reject(new Error(errorMessage));
        return;
      }

      // Parse JSON from stdout
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (parseErr) {
        reject(new Error(
          `Failed to parse Python wrapper output as JSON: ${parseErr.message}\n` +
          `Raw stdout (first 500 chars): ${stdout.slice(0, 500)}`
        ));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn Python wrapper: ${err.message}`));
    });
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Phase 1: Generate a new topology from natural language.
 *
 * @param {Object} opts
 * @param {string} opts.request - Network description in natural language
 * @param {string} [opts.profile='{}'] - JSON string with profile settings
 * @param {string} [opts.chatHistory='[]'] - JSON string of chat history
 * @param {string} [opts.securityProfile='none'] - Security profile: none|basic|enterprise
 * @param {string} [opts.catalogPath] - Path to custom catalog JSON
 * @param {string} [opts.outputDir] - Output directory for generated files
 * @param {number} [timeout] - Max time in ms
 * @returns {Promise<Object>} - { success, topology_dict, topology_data, requirements, ... }
 */
async function generate({
  request,
  profile = "{}",
  chatHistory = "[]",
  securityProfile = "none",
  catalogPath,
  outputDir,
} = {}, timeout) {
  if (!request) {
    throw new Error("request is required for generate()");
  }

  const args = [
    "generate",
    "--request", request,
    "--profile", typeof profile === "string" ? profile : JSON.stringify(profile),
    "--chat-history", typeof chatHistory === "string" ? chatHistory : JSON.stringify(chatHistory),
    "--security-profile", securityProfile,
  ];

  if (catalogPath) args.push("--catalog-path", catalogPath);
  if (outputDir) args.push("--output-dir", outputDir);

  return _spawnWrapper(args, timeout);
}

/**
 * Phase 1 (edit): Re-generate topology with feedback.
 *
 * @param {Object} opts
 * @param {string} opts.feedback - Edit feedback from user
 * @param {string} opts.topology - Path to current topology JSON
 * @param {string} [opts.chatHistory='[]'] - JSON string of chat history
 * @param {string} [opts.originalRequest] - Original user request string
 * @param {string} [opts.securityProfile='none'] - Security profile
 * @param {string} [opts.profile='{}'] - JSON string with profile settings
 * @param {string} [opts.catalogPath] - Path to custom catalog JSON
 * @param {string} [opts.outputDir] - Output directory
 * @param {number} [timeout] - Max time in ms
 * @returns {Promise<Object>} - Same as generate()
 */
async function edit({
  feedback,
  topology,
  chatHistory = "[]",
  originalRequest,
  securityProfile = "none",
  profile = "{}",
  catalogPath,
  outputDir,
} = {}, timeout) {
  if (!feedback) {
    throw new Error("feedback is required for edit()");
  }
  if (!topology) {
    throw new Error("topology path is required for edit()");
  }

  const args = [
    "edit",
    "--feedback", feedback,
    "--topology", topology,
    "--chat-history", typeof chatHistory === "string" ? chatHistory : JSON.stringify(chatHistory),
    "--security-profile", securityProfile,
    "--profile", typeof profile === "string" ? profile : JSON.stringify(profile),
  ];

  if (originalRequest) args.push("--original-request", originalRequest);
  if (catalogPath) args.push("--catalog-path", catalogPath);
  if (outputDir) args.push("--output-dir", outputDir);

  return _spawnWrapper(args, timeout);
}

/**
 * Phase 2 + GNS3 export: Generate configs and export .gns3project file.
 *
 * @param {Object} opts
 * @param {string} opts.topology - Path to Phase 1 topology JSON
 * @param {string} [opts.securityProfile='none'] - Security profile
 * @param {string} [opts.profile='{}'] - JSON string with profile settings
 * @param {string} [opts.catalogPath] - Path to custom catalog JSON
 * @param {string} [opts.outputDir] - Output directory
 * @param {boolean} [opts.noValidate=false] - Skip GNS3 project validation
 * @param {number} [timeout] - Max time in ms (default: 10 min — Phase 2 is slow)
 * @returns {Promise<Object>} - { success, final_dict, gns3project_path, config_texts, ... }
 */
async function exportProject({
  topology,
  securityProfile = "none",
  profile = "{}",
  catalogPath,
  outputDir,
  noValidate = false,
} = {}, timeout = 10 * 60 * 1000) {
  if (!topology) {
    throw new Error("topology path is required for export()");
  }

  const args = [
    "export",
    "--topology", topology,
    "--security-profile", securityProfile,
    "--profile", typeof profile === "string" ? profile : JSON.stringify(profile),
  ];

  if (catalogPath) args.push("--catalog-path", catalogPath);
  if (outputDir) args.push("--output-dir", outputDir);
  if (noValidate) args.push("--no-validate");

  return _spawnWrapper(args, timeout);
}

/**
 * Cisco knowledge base search.
 *
 * @param {Object} opts
 * @param {string} opts.topic - Topic to search (e.g. 'OSPF configuration')
 * @param {number} [timeout] - Max time in ms
 * @returns {Promise<Object>} - { success, topic, answer }
 */
async function searchQA({ topic } = {}, timeout) {
  if (!topic) {
    throw new Error("topic is required for searchQA()");
  }

  return _spawnWrapper(["qa", "--topic", topic], timeout);
}

/**
 * Build configuration brief (debugging / inspection).
 *
 * @param {Object} opts
 * @param {string} opts.topology - Path to topology JSON
 * @param {number} [timeout] - Max time in ms
 * @returns {Promise<Object>} - { success, brief, brief_length }
 */
async function brief({ topology } = {}, timeout) {
  if (!topology) {
    throw new Error("topology path is required for brief()");
  }

  return _spawnWrapper(["brief", "--topology", topology], timeout);
}

/**
 * Generate image requirements checklist.
 *
 * @param {Object} opts
 * @param {string} opts.topology - Path to topology JSON
 * @param {string} [opts.templateImageMap='{}'] - JSON: template_name -> image_filename
 * @param {string} [opts.output] - Output path for manifest .txt
 * @param {number} [timeout] - Max time in ms
 * @returns {Promise<Object>} - { success, manifest_path, manifest_content }
 */
async function manifest({
  topology,
  templateImageMap = "{}",
  output,
} = {}, timeout) {
  if (!topology) {
    throw new Error("topology path is required for manifest()");
  }

  const args = [
    "manifest",
    "--topology", topology,
    "--template-image-map", typeof templateImageMap === "string" ? templateImageMap : JSON.stringify(templateImageMap),
  ];

  if (output) args.push("--output", output);

  return _spawnWrapper(args, timeout);
}

/**
 * Validate a topology JSON file against the GNS3Project schema.
 *
 * @param {Object} opts
 * @param {string} opts.topology - Path to topology JSON
 * @param {number} [timeout] - Max time in ms
 * @returns {Promise<Object>} - { success, valid, node_count?, link_count?, error? }
 */
async function validate({ topology } = {}, timeout) {
  if (!topology) {
    throw new Error("topology path is required for validate()");
  }

  return _spawnWrapper(["validate", "--topology", topology], timeout);
}

// ─── Exports ────────────────────────────────────────────────────────────────

export default {
  generate,
  edit,
  exportProject,
  searchQA,
  brief,
  manifest,
  validate,
  _spawnWrapper,
  WRAPPER_PATH,
  PYTHON_BIN,
  DEFAULT_TIMEOUT,
};
