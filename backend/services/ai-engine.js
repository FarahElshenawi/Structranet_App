/**
 * ai-engine.js — Python wrapper client for StructuraNet AI.
 * Spawns `python wrapper.py <command>` as a child process and returns
 * the parsed JSON result.
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WRAPPER_PATH = process.env.STRUCTRANET_WRAPPER_PATH ||
  path.resolve(__dirname, "../../ai-engine/wrapper.py");
const PYTHON_BIN = process.env.STRUCTRANET_PYTHON || "python";
const DEFAULT_TIMEOUT = 5 * 60 * 1000;

function _spawnWrapper(args, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [WRAPPER_PATH, ...args], {
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`Python wrapper timed out after ${timeout}ms`));
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        let errorMessage = `Python wrapper exited with code ${code}`;
        try {
          const errJson = JSON.parse(stderr.trim().split("\n").pop());
          if (errJson.error) { errorMessage = errJson.error; if (errJson.details) errorMessage += ` — ${errJson.details}`; }
        } catch {
          if (stderr.trim()) errorMessage += `: ${stderr.trim().slice(-500)}`;
        }
        reject(new Error(errorMessage));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (parseErr) {
        reject(new Error(`Failed to parse Python wrapper output as JSON: ${parseErr.message}\nRaw stdout (first 500 chars): ${stdout.slice(0, 500)}`));
      }
    });

    proc.on("error", (err) => { clearTimeout(timer); reject(new Error(`Failed to spawn Python wrapper: ${err.message}`)); });
  });
}

async function generate({ request, profile = "{}", chatHistory = "[]", securityProfile = "none", catalogPath, outputDir } = {}, timeout) {
  if (!request) throw new Error("request is required for generate()");
  const args = ["generate", "--request", request, "--profile", typeof profile === "string" ? profile : JSON.stringify(profile),
    "--chat-history", typeof chatHistory === "string" ? chatHistory : JSON.stringify(chatHistory), "--security-profile", securityProfile];
  if (catalogPath) args.push("--catalog-path", catalogPath);
  if (outputDir) args.push("--output-dir", outputDir);
  return _spawnWrapper(args, timeout);
}

async function edit({ feedback, topology, chatHistory = "[]", originalRequest, securityProfile = "none", profile = "{}", catalogPath, outputDir } = {}, timeout) {
  if (!feedback) throw new Error("feedback is required for edit()");
  if (!topology) throw new Error("topology path is required for edit()");
  const args = ["edit", "--feedback", feedback, "--topology", topology,
    "--chat-history", typeof chatHistory === "string" ? chatHistory : JSON.stringify(chatHistory),
    "--security-profile", securityProfile, "--profile", typeof profile === "string" ? profile : JSON.stringify(profile)];
  if (originalRequest) args.push("--original-request", originalRequest);
  if (catalogPath) args.push("--catalog-path", catalogPath);
  if (outputDir) args.push("--output-dir", outputDir);
  return _spawnWrapper(args, timeout);
}

async function exportProject({ topology, securityProfile = "none", profile = "{}", catalogPath, outputDir, noValidate = false } = {}, timeout = 10 * 60 * 1000) {
  if (!topology) throw new Error("topology path is required for export()");
  const args = ["export", "--topology", topology, "--security-profile", securityProfile,
    "--profile", typeof profile === "string" ? profile : JSON.stringify(profile)];
  if (catalogPath) args.push("--catalog-path", catalogPath);
  if (outputDir) args.push("--output-dir", outputDir);
  if (noValidate) args.push("--no-validate");
  return _spawnWrapper(args, timeout);
}

async function searchQA({ topic } = {}, timeout) {
  if (!topic) throw new Error("topic is required for searchQA()");
  return _spawnWrapper(["qa", "--topic", topic], timeout);
}

async function brief({ topology } = {}, timeout) {
  if (!topology) throw new Error("topology path is required for brief()");
  return _spawnWrapper(["brief", "--topology", topology], timeout);
}

async function manifest({ topology, templateImageMap = "{}", output } = {}, timeout) {
  if (!topology) throw new Error("topology path is required for manifest()");
  const args = ["manifest", "--topology", topology, "--template-image-map", typeof templateImageMap === "string" ? templateImageMap : JSON.stringify(templateImageMap)];
  if (output) args.push("--output", output);
  return _spawnWrapper(args, timeout);
}

async function validate({ topology } = {}, timeout) {
  if (!topology) throw new Error("topology path is required for validate()");
  return _spawnWrapper(["validate", "--topology", topology], timeout);
}

export {
  generate, edit, exportProject, searchQA, brief, manifest, validate,
  _spawnWrapper, WRAPPER_PATH, PYTHON_BIN, DEFAULT_TIMEOUT,
};

export default {
  generate, edit, exportProject, searchQA, brief, manifest, validate,
  _spawnWrapper, WRAPPER_PATH, PYTHON_BIN, DEFAULT_TIMEOUT,
};
