import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import User from "./models/User.js";
import UserChat from "./models/userChat.js";
import Chat from "./models/chat.js";
import { dispatch, AgentSessionData } from "./services/chat-orchestrator.js";

dotenv.config();

const port = process.env.PORT || 3000;
const app = express();
const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// ─── C6: Restrict CORS to frontend domain in production ──────────────────────
// In production, only allow the configured frontend origin.
// In development, allow all origins for convenience.
const CORS_ORIGIN = process.env.CORS_ORIGIN || null; // e.g. "https://structuranet.ai"

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (CORS_ORIGIN) {
      // Production: strict allowlist
      const allowed = CORS_ORIGIN.split(",").map(o => o.trim());
      if (allowed.includes(origin) || allowed.includes("*")) {
        return callback(null, true);
      }
      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(new Error("CORS not allowed"), false);
    }

    // Development: allow all
    return callback(null, true);
  },
  credentials: true,
}));

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// ─── H5: Input validation middleware ────────────────────────────────────────
// Validates request bodies against a simple schema before route handlers run.
// Returns 400 with a descriptive error if validation fails.
const validateBody = (schema) => (req, res, next) => {
  for (const [field, rules] of Object.entries(schema)) {
    const val = req.body[field];
    if (rules.required && (val === undefined || val === null || val === '')) {
      return res.status(400).json({ error: `${field} is required` });
    }
    if (rules.type && val !== undefined && typeof val !== rules.type) {
      return res.status(400).json({ error: `${field} must be a ${rules.type}` });
    }
    if (rules.minLength && typeof val === 'string' && val.length < rules.minLength) {
      return res.status(400).json({ error: `${field} must be at least ${rules.minLength} characters` });
    }
    if (rules.minLength && Array.isArray(val) && val.length < rules.minLength) {
      return res.status(400).json({ error: `${field} must have at least ${rules.minLength} items` });
    }
    if (rules.isArray && !Array.isArray(val)) {
      return res.status(400).json({ error: `${field} must be an array` });
    }
  }
  next();
};

// Connect to MongoDB in background
const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO;
    if (!mongoUri || mongoUri.includes("localhost:27017")) {
      try {
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        const mongod = await MongoMemoryServer.create();
        mongoUri = mongod.getUri();
        console.log("📦 Using in-memory MongoDB");
      } catch (e) { console.log("📡 No MongoDB — limited mode"); return; }
    }
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");
  } catch (e) { console.log("📡 MongoDB unavailable — limited mode"); }
};
connectDB();

// ─── C7: Replace hardcoded JWT_SECRET with env-var-only loading ──────────────
// JWT_SECRET MUST come from the environment. There is no fallback default.
// If it is missing, the server will start but auth endpoints will return 500.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET environment variable is not set.");
  console.error("   Set it in your .env file before starting the server.");
  console.error("   Example: JWT_SECRET=$(openssl rand -hex 32)");
}

/* ═══════════════════════════════════════════════════════════════════════
   C3: SESSION PERSISTENCE FOR AGENT SESSION DATA
   ═══════════════════════════════════════════════════════════════════════

   Previously, AgentSessionData was stored in-memory on session._agentData.
   If the Node.js process restarted, all active sessions were lost.

   Now we use a SessionStore that persists to MongoDB when available,
   with an in-memory LRU fallback when MongoDB is down. The store
   provides get/set/delete semantics keyed by sessionId.

   The chat-orchestrator.dispatch() receives the session store and
   reads/writes AgentSessionData through it.
   ═══════════════════════════════════════════════════════════════════════ */

const _memoryStore = new Map();

/**
 * Persistent session store — MongoDB-backed with in-memory fallback.
 *
 * When MongoDB is connected, session data is serialized to the `agentsessions`
 * collection. When MongoDB is unavailable, an in-memory Map is used (data is
 * lost on process restart, but the app remains functional for development).
 */
const SessionStore = {
  async get(sessionId) {
    // Try MongoDB first
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await mongoose.connection.db
          .collection("agentsessions")
          .findOne({ _id: sessionId });
        if (doc) return AgentSessionData.fromJSON(doc.data);
      } catch (e) {
        console.warn("[SessionStore] MongoDB read failed, using memory:", e.message);
      }
    }
    // Fallback to memory
    return _memoryStore.get(sessionId) || null;
  },

  async set(sessionId, agentData) {
    // Write to MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        await mongoose.connection.db
          .collection("agentsessions")
          .replaceOne(
            { _id: sessionId },
            { _id: sessionId, data: agentData.toJSON(), updatedAt: new Date() },
            { upsert: true }
          );
      } catch (e) {
        console.warn("[SessionStore] MongoDB write failed:", e.message);
      }
    }
    // Always mirror to memory for fast reads
    _memoryStore.set(sessionId, agentData);
  },

  async delete(sessionId) {
    _memoryStore.delete(sessionId);
    if (mongoose.connection.readyState === 1) {
      try {
        await mongoose.connection.db.collection("agentsessions").deleteOne({ _id: sessionId });
      } catch (e) { /* ignore */ }
    }
  },
};

/* ═══════════════════════════════════════════════════════════════════════
   SSE BROADCAST MANAGER
   ═══════════════════════════════════════════════════════════════════════

   Manages Server-Sent Events connections per session. Each session can
   have one active SSE subscriber (the frontend). The broadcast() method
   sends events to all subscribers of a given session.

   This replaces the previous pattern of storing SSE res objects on
   the Express session — it's now a dedicated, typed manager.
   ═══════════════════════════════════════════════════════════════════════ */

const _sseClients = new Map(); // sessionId → Set<res>

const SSEManager = {
  /** Add a new SSE client for a session. */
  addClient(sessionId, res) {
    if (!_sseClients.has(sessionId)) _sseClients.set(sessionId, new Set());
    _sseClients.get(sessionId).add(res);
  },

  /** Remove an SSE client. */
  removeClient(sessionId, res) {
    const clients = _sseClients.get(sessionId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) _sseClients.delete(sessionId);
    }
  },

  /** Broadcast an event to all SSE clients of a session. */
  broadcast(session, event) {
    const sessionId = session?.sessionId || session?._id;
    if (!sessionId) return;
    const clients = _sseClients.get(sessionId);
    if (!clients || clients.size === 0) return;
    const payload = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const res of clients) {
      try { res.write(payload); } catch (e) { /* client disconnected */ }
    }
  },
};

/* ═══════════════════════════════════════════════════════════════════════
   C2: REPLACED DEAD FASTAPI PROXY WITH NATIVE EXPRESS ENDPOINTS
   ═══════════════════════════════════════════════════════════════════════

   The previous /api/ai/* middleware proxied ALL requests to a FastAPI
   server that does not exist in the codebase. This caused every request
   to /api/ai/* to return 502 errors.

   Now, the Express server handles all AI engine interactions directly:
     - Session management is done in Express with MongoDB persistence
     - AI commands are dispatched via chat-orchestrator + ai-engine.js
     - SSE streaming is managed by the SSEManager above
     - Downloads are served from the filesystem
     - The /api/catalog proxy to FastAPI is kept since it may be deployed
       separately in some configurations

   The old proxy is completely removed. The few endpoints that still
   need FastAPI (catalog) have their own dedicated routes.
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   C1: POST /api/chat — THE MISSING CHAT ROUTE
   ═══════════════════════════════════════════════════════════════════════

   This is the core chat endpoint that the frontend's agentChat()
   function calls. It was previously missing — the chat-orchestrator's
   dispatch() function was never invoked by any route.

   The endpoint:
     1. Authenticates the user via JWT
     2. Gets or creates a session (with persistent AgentSessionData)
     3. Calls chat-orchestrator.dispatch() to run the LLM tool-calling loop
     4. Persists the updated AgentSessionData
     5. Returns the agent's response (SSE events are streamed separately)
   ═══════════════════════════════════════════════════════════════════════ */

app.post("/api/chat", requireAuth, validateBody({ message: { required: true, type: 'string' } }), async (req, res) => {
  try {
    const { session_id, message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    // Get or create session ID
    const sessionId = session_id || uuidv4();

    // Get or create persistent agent session data
    let agentData = await SessionStore.get(sessionId);
    if (!agentData) {
      agentData = new AgentSessionData();
      await SessionStore.set(sessionId, agentData);
    }

    // Build the session object that tool handlers expect
    // It carries profile info, output directory, and session ID
    const user = await User.findById(req.userId).select("gns3Profile").catch(() => null);
    const session = {
      sessionId,
      _id: sessionId,
      userId: req.userId,
      profile: user?.gns3Profile ? JSON.stringify({
        version: user.gns3Profile.version || "",
        features: user.gns3Profile.features || {},
        images: user.gns3Profile.images instanceof Map
          ? Object.fromEntries(user.gns3Profile.images)
          : (user.gns3Profile.images || {}),
        security_profile: user.gns3Profile.security_profile || "none",
      }) : "{}",
      outputDir: process.env.OUTPUT_DIR || "/tmp/structuranet",
    };

    // Ensure output directory exists
    try {
      const { mkdirSync } = await import("fs");
      mkdirSync(session.outputDir, { recursive: true });
    } catch (e) { /* may already exist */ }

    // Load persisted agent data into the session for the orchestrator
    session._agentData = agentData;

    // Dispatch through the LLM tool-calling orchestrator
    // This is the main AI interaction point — it may call Python via child_process
    const result = await dispatch(message.trim(), session, SSEManager);

    // Persist the updated agent session data
    await SessionStore.set(sessionId, session._agentData);

    res.json({
      session_id: sessionId,
      message: result.message,
      tool_calls_made: result.toolCallsMade,
    });
  } catch (err) {
    console.error("[/api/chat] Error:", err);
    res.status(500).json({ error: "Chat processing failed", detail: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   SESSION MANAGEMENT — Create, get, SSE subscribe, download
   ═══════════════════════════════════════════════════════════════════════ */

/** Create a new session (returns session ID for SSE subscription). */
app.post("/api/ai/sessions", requireAuth, async (req, res) => {
  try {
    const sessionId = uuidv4();
    const agentData = new AgentSessionData();
    await SessionStore.set(sessionId, agentData);
    res.status(201).json({
      session_id: sessionId,
      status: "created",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create session" });
  }
});

/** Get session info. */
app.get("/api/ai/sessions/:sessionId", requireAuth, async (req, res) => {
  try {
    const agentData = await SessionStore.get(req.params.sessionId);
    if (!agentData) return res.status(404).json({ error: "Session not found" });
    res.json({
      session_id: req.params.sessionId,
      has_topology: !!agentData.topologyDict,
      topology_approved: agentData.topologyApproved,
      edit_iterations: agentData.editIterations,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/** SSE endpoint — the frontend subscribes here for real-time events. */
app.get("/api/ai/sessions/:sessionId/events", requireAuth, async (req, res) => {
  const { sessionId } = req.params;

  // Verify session exists
  const agentData = await SessionStore.get(sessionId);
  if (!agentData) {
    return res.status(404).json({ error: "Session not found" });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // Register as SSE client
  SSEManager.addClient(sessionId, res);

  // Send initial keepalive
  res.write(`event: keepalive\ndata: {}\n\n`);

  // Cleanup on disconnect
  req.on("close", () => {
    SSEManager.removeClient(sessionId, res);
  });
});

/** Download the .gns3project file for a session. */
app.get("/api/ai/sessions/:sessionId/download", requireAuth, async (req, res) => {
  try {
    const agentData = await SessionStore.get(req.params.sessionId);
    if (!agentData) return res.status(404).json({ error: "Session not found" });

    // Try to serve from the session's gns3project path
    // The path was stored by the chat-orchestrator after export
    const { existsSync, createReadStream } = await import("fs");
    const gns3Path = req.session?.gns3projectPath;

    if (gns3Path && existsSync(gns3Path)) {
      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", `attachment; filename="network.gns3project"`);
      return createReadStream(gns3Path).pipe(res);
    }

    // Fallback: try to find in output directory
    const outputDir = process.env.OUTPUT_DIR || "/tmp/structuranet";
    const { readdirSync } = await import("fs");
    const { join } = await import("path");

    if (existsSync(outputDir)) {
      const files = readdirSync(outputDir).filter(f => f.endsWith(".gns3project"));
      if (files.length > 0) {
        const latest = files.sort().pop();
        const filePath = join(outputDir, latest);
        res.setHeader("Content-Type", "application/gzip");
        res.setHeader("Content-Disposition", `attachment; filename="${latest}"`);
        return createReadStream(filePath).pipe(res);
      }
    }

    res.status(404).json({ error: "No export file found for this session" });
  } catch (err) {
    res.status(500).json({ error: "Download failed", detail: err.message });
  }
});

/** Download device configurations as a zip. */
app.get("/api/ai/sessions/:sessionId/download/configs", requireAuth, async (req, res) => {
  // Placeholder — will stream config files when export is implemented
  res.status(404).json({ error: "Configs download not yet available for this session" });
});

/** Download requirements manifest. */
app.get("/api/ai/sessions/:sessionId/download/requirements", requireAuth, async (req, res) => {
  try {
    const agentData = await SessionStore.get(req.params.sessionId);
    if (!agentData) return res.status(404).json({ error: "Session not found" });
    if (!agentData.topologyDict) return res.status(404).json({ error: "No topology in this session" });

    // Generate a simple requirements manifest from the topology
    const nodes = agentData.topologyDict?.topology?.nodes || [];
    const manifest = nodes.map(n => ({
      name: n.name,
      template: n.template_name,
      node_type: n.node_type,
      image_required: !["ethernet_switch", "ethernet_hub", "vpcs"].includes(n.node_type),
    }));

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="requirements.json"`);
    res.json(manifest);
  } catch (err) {
    res.status(500).json({ error: "Requirements download failed" });
  }
});

/** Health check for the AI engine (no longer proxied to FastAPI). */
app.get("/api/ai/health", (req, res) => {
  res.json({ status: "ok", service: "express-ai-engine", mode: "native" });
});

/* ═══════════════════════════════════════════════════════════════════════
   AUTH — JWT-based authentication
   ═══════════════════════════════════════════════════════════════════════ */

app.post("/api/auth/signup", validateBody({ username: { required: true, type: 'string' }, email: { required: true, type: 'string' }, password: { required: true, type: 'string', minLength: 6 } }), async (req, res) => {
  try {
    if (!JWT_SECRET) return res.status(500).json({ error: "Server misconfigured: JWT_SECRET not set" });
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "Database not available" });
    const { username, email, password } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ error: "Email already exists" });
    await User.create({ username, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ message: "User created successfully" });
  } catch (err) { res.status(500).json({ error: "Signup failed" }); }
});

app.post("/api/auth/signin", validateBody({ email: { required: true, type: 'string' }, password: { required: true, type: 'string' } }), async (req, res) => {
  try {
    if (!JWT_SECRET) return res.status(500).json({ error: "Server misconfigured: JWT_SECRET not set" });
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "Database not available. Use demo login." });
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: "Invalid credentials" });
    const token = jwt.sign({ userId: user._id.toString(), username: user.username, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id.toString(), username: user.username, email: user.email } });
  } catch (err) { res.status(500).json({ error: "Signin failed" }); }
});

app.post("/api/auth/demo", async (req, res) => {
  try {
    if (!JWT_SECRET) return res.status(500).json({ error: "Server misconfigured: JWT_SECRET not set" });
    if (mongoose.connection.readyState === 1) {
      let demoUser = await User.findOne({ email: "demo@structuranet.ai" });
      if (!demoUser) {
        demoUser = await User.create({ username: "Demo User", email: "demo@structuranet.ai", password: await bcrypt.hash("demo123", 10) });
      }
      const token = jwt.sign({ userId: demoUser._id.toString(), username: demoUser.username, email: demoUser.email }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, user: { id: demoUser._id.toString(), username: demoUser.username, email: demoUser.email } });
    }
    const token = jwt.sign({ userId: "demo-user-001", username: "Demo User", email: "demo@structuranet.ai" }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: "demo-user-001", username: "Demo User", email: "demo@structuranet.ai" } });
  } catch (err) { res.status(500).json({ error: "Demo login failed" }); }
});

/**
 * requireAuth middleware
 *
 * Accepts tokens from both:
 *   - Authorization: Bearer xxx header
 *   - ?token=xxx query parameter (for SSE / EventSource connections)
 */
function requireAuth(req, res, next) {
  try {
    if (!JWT_SECRET) return res.status(500).json({ error: "Server misconfigured: JWT_SECRET not set" });
    const authHeader = req.headers.authorization;
    const queryToken = req.query && req.query.token;
    const token = (authHeader && authHeader.split(" ")[1]) || queryToken;
    if (!token) return res.status(401).json({ error: "No token" });
    req.userId = jwt.verify(token, JWT_SECRET).userId.toString();
    next();
  } catch (err) { return res.status(401).json({ error: "Invalid token" }); }
}

/* ═══════════════════════════════════════════════════════════════════════
   CHAT API — CRUD for chat history
   ═══════════════════════════════════════════════════════════════════════ */

app.post("/api/chats", requireAuth, (req, res, next) => {
  // H5: Only validate text field when MongoDB is available
  if (mongoose.connection.readyState !== 1) return next();
  validateBody({ text: { required: true, type: 'string' } })(req, res, next);
}, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.status(201).json({ _id: "chat-" + Date.now(), userId: req.userId, messages: [{ role: "user", content: req.body.text || "" }], createdAt: new Date().toISOString() });
  try {
    const chat = new Chat({ userId: req.userId, messages: [{ role: "user", content: req.body.text || "" }] });
    const saved = await chat.save();
    const title = (req.body.text || "").substring(0, 40) || "New Chat";
    let uc = await UserChat.findOne({ userId: req.userId });
    if (!uc) { uc = new UserChat({ userId: req.userId, chats: [{ _id: saved._id, title, starred: false, createdAt: saved.createdAt }] }); await uc.save(); }
    else { await UserChat.updateOne({ userId: req.userId }, { $push: { chats: { _id: saved._id, title, starred: false, createdAt: saved.createdAt } } }); }
    res.status(201).json(saved);
  } catch (e) { res.status(500).json({ error: "Error creating chat" }); }
});

app.get("/api/userchats", requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ chats: [] });
  try { const doc = await UserChat.findOne({ userId: req.userId }); res.json(doc || { chats: [] }); }
  catch (e) { res.status(500).json({ error: "Failed to fetch" }); }
});

app.get("/api/chats/:chatId", requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ _id: req.params.chatId, messages: [] });
  try { const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.userId }); if (!chat) return res.status(404).json({ error: "Not found" }); res.json(chat); }
  catch (e) { res.status(500).json({ error: "Failed" }); }
});

app.post("/api/chats/:chatId/messages", requireAuth, validateBody({ messages: { required: true, isArray: true, minLength: 1 } }), async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ ok: true });
  try { const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.userId }); if (!chat) return res.status(404); chat.messages.push(...(req.body.messages || []).map(m => ({ role: m.role, content: m.content || "" }))); await chat.save(); res.json(chat); }
  catch (e) { res.status(500).json({ error: "Failed" }); }
});

app.delete("/api/chats/:chatId", requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ message: "Deleted" });
  try {
    await Chat.findByIdAndDelete(req.params.chatId);
    await UserChat.updateOne(
      { userId: req.userId },
      { $pull: { chats: { _id: req.params.chatId } } }
    );
    res.json({ message: "Deleted" });
  }
  catch (e) { res.status(500).json({ error: "Failed" }); }
});

app.put("/api/chats/:chatId/session", requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ message: "Updated" });
  try {
    const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.userId });
    if (!chat) return res.status(404);
    chat.sessionId = req.body.sessionId;
    await chat.save();
    res.json({ message: "Updated" });
  }
  catch (e) { res.status(500).json({ error: "Failed" }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   PROFILE API — GNS3 environment profile
   ═══════════════════════════════════════════════════════════════════════ */

function profileToPlain(profile) {
  if (!profile) return {};
  return {
    version: profile.version || "",
    features: profile.features
      ? { iou: !!profile.features.iou, qemu: !!profile.features.qemu, docker: !!profile.features.docker }
      : { iou: false, qemu: true, docker: false },
    images: profile.images instanceof Map
      ? Object.fromEntries(profile.images)
      : (profile.images || {}),
    security_profile: profile.security_profile || "none",
  };
}

app.get("/api/profile", requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ profile: {} });
  try {
    const user = await User.findById(req.userId).select("gns3Profile");
    res.json({ profile: profileToPlain(user?.gns3Profile) });
  } catch (e) { res.status(500).json({ error: "Failed" }); }
});

app.put("/api/profile", requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ profile: req.body });
  try {
    const { version, features, images, security_profile } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404);

    if (!user.gns3Profile) user.gns3Profile = {};

    if (version !== undefined) user.gns3Profile.version = version;
    if (features) user.gns3Profile.features = { ...user.gns3Profile.features, ...features };

    if (images !== undefined) {
      if (typeof images === "object" && images !== null) {
        const map = new Map(Object.entries(images));
        user.gns3Profile.images = map;
      } else {
        user.gns3Profile.images = new Map();
      }
    }

    if (security_profile !== undefined) {
      const valid = ["none", "basic", "enterprise"];
      user.gns3Profile.security_profile = valid.includes(security_profile)
        ? security_profile
        : "none";
    }

    await user.save();
    res.json({ profile: profileToPlain(user.gns3Profile) });
  } catch (e) { res.status(500).json({ error: "Failed" }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   APPLIANCE CATALOG — Kept as proxy to FastAPI
   (FastAPI may be deployed separately for the catalog service)
   ═══════════════════════════════════════════════════════════════════════ */

app.get("/api/catalog", requireAuth, async (req, res) => {
  try {
    const catalogRes = await fetch(`${FASTAPI_URL}/catalog`, {
      headers: { authorization: req.headers.authorization },
      signal: AbortSignal.timeout(10000),
    });
    if (!catalogRes.ok) {
      return res.status(catalogRes.status).json({ error: `Catalog fetch failed: ${catalogRes.status}` });
    }
    const data = await catalogRes.json();
    res.json(data);
  } catch (e) {
    console.error("Catalog proxy error:", e.message);
    res.status(502).json({ error: "AI engine unavailable for catalog", detail: e.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   HEALTH CHECK
   ═══════════════════════════════════════════════════════════════════════ */

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "express", db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🔒 CORS origin: ${CORS_ORIGIN || "(dev: allow all)"}`);
  console.log(`🔑 JWT_SECRET: ${JWT_SECRET ? "configured" : "❌ NOT SET"}`);
  console.log(`💬 POST /api/chat — chat-orchestrator endpoint active`);
  console.log(`📡 SSE /api/ai/sessions/:id/events — real-time streaming active`);
});


// Add this route — frontend agentChat() calls /api/ai/agent/chat
app.post("/api/ai/agent/chat", requireAuth, async (req, res) => {
  try {
    const { session_id, message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "message is required" });

    const sessionId = session_id;
    if (!sessionId) return res.status(400).json({ error: "session_id is required" });

    let agentData = await SessionStore.get(sessionId);
    if (!agentData) agentData = new AgentSessionData();

    const user = await User.findById(req.userId).select("gns3Profile").catch(() => null);
    const session = {
      sessionId,
      _id: sessionId,
      userId: req.userId,
      profile: user?.gns3Profile ? JSON.stringify({
        version: user.gns3Profile.version || "",
        features: user.gns3Profile.features || {},
        images: user.gns3Profile.images instanceof Map
          ? Object.fromEntries(user.gns3Profile.images)
          : (user.gns3Profile.images || {}),
        security_profile: user.gns3Profile.security_profile || "none",
      }) : "{}",
      outputDir: process.env.OUTPUT_DIR || "/tmp/structuranet",
    };

    try { const { mkdirSync } = await import("fs"); mkdirSync(session.outputDir, { recursive: true }); } catch {}

    session._agentData = agentData;
    const result = await dispatch(message.trim(), session, SSEManager);
    await SessionStore.set(sessionId, session._agentData);

    res.json({ session_id: sessionId, message: result.message, tool_calls_made: result.toolCallsMade });
  } catch (err) {
    console.error("[/api/ai/agent/chat] Error:", err);
    res.status(500).json({ error: "Chat processing failed", detail: err.message });
  }
});