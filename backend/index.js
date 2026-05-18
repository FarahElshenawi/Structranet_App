import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import UserChat from "./models/userChat.js";
import Chat from "./models/chat.js";

dotenv.config();

const port = process.env.PORT || 3000;
const app = express();
const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

app.use(cors({ origin: (o, cb) => cb(null, true), credentials: true }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

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

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";

/* ================= MANUAL FASTAPI PROXY ================= */
// Replaces broken http-proxy-middleware with a working fetch-based proxy.
// Express strips /api/ai from the mounted path, so /api/ai/sessions → /sessions
// We forward /sessions to http://localhost:8000/sessions

app.use("/api/ai", async (req, res) => {
  const targetPath = req.originalUrl.replace(/^\/api\/ai/, "") || "/";
  const targetUrl = `${FASTAPI_URL}${targetPath}`;

  // Build headers — forward auth and content-type
  const headers = {};
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
  const queryToken = req.query && req.query.token;
  if (queryToken) headers["authorization"] = `Bearer ${queryToken}`;
  else if (req.headers.authorization) headers["authorization"] = req.headers.authorization;

  try {
    // SSE endpoint — stream the response
    if (targetPath.includes("/events")) {
      const sseRes = await fetch(targetUrl, {
        method: "GET",
        headers: { ...headers, accept: "text/event-stream" },
      });

      if (!sseRes.ok) {
        return res.status(sseRes.status).json({ error: `FastAPI SSE error: ${sseRes.status}` });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const reader = sseRes.body.getReader();
      const decoder = new TextDecoder();

      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);
          }
        } catch (e) {
          // Client disconnected or error
        } finally {
          res.end();
        }
      };

      req.on("close", () => { reader.cancel().catch(() => {}); });
      pump();
      return;
    }

    // File download endpoints — stream binary
    if (targetPath.includes("/download")) {
      const dlRes = await fetch(targetUrl, { method: "GET", headers });
      if (!dlRes.ok) {
        return res.status(dlRes.status).json({ error: `Download failed: ${dlRes.status}` });
      }
      const contentType = dlRes.headers.get("content-type") || "application/octet-stream";
      const contentDisposition = dlRes.headers.get("content-disposition");
      res.setHeader("Content-Type", contentType);
      if (contentDisposition) res.setHeader("Content-Disposition", contentDisposition);

      const buffer = await dlRes.arrayBuffer();
      return res.send(Buffer.from(buffer));
    }

    // Regular JSON endpoints
    const fetchOptions = {
      method: req.method,
      headers,
    };

    // Add body for POST/PUT/PATCH
    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const aiRes = await fetch(targetUrl, fetchOptions);
    const data = await aiRes.json().catch(() => ({}));

    if (!aiRes.ok) {
      return res.status(aiRes.status).json(data);
    }
    res.json(data);
  } catch (err) {
    console.error(`Proxy error [${req.method} ${targetPath}]:`, err.message);
    res.status(502).json({ error: "AI engine unavailable", detail: err.message });
  }
});

/* ================= AUTH ================= */

app.post("/api/auth/signup", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "Database not available" });
    const { username, email, password } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ error: "Email already exists" });
    await User.create({ username, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ message: "User created successfully" });
  } catch (err) { res.status(500).json({ error: "Signup failed" }); }
});

app.post("/api/auth/signin", async (req, res) => {
  try {
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

const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = req.query && req.query.token;
    const token = (authHeader && authHeader.split(" ")[1]) || queryToken;
    if (!token) return res.status(401).json({ error: "No token" });
    req.userId = jwt.verify(token, JWT_SECRET).userId.toString();
    next();
  } catch (err) { return res.status(401).json({ error: "Invalid token" }); }
};

/* ================= API ================= */

app.post("/api/chats", requireAuth, async (req, res) => {
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

app.post("/api/chats/:chatId/messages", requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ ok: true });
  try { const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.userId }); if (!chat) return res.status(404); chat.messages.push(...(req.body.messages || []).map(m => ({ role: m.role, content: m.content || "" }))); await chat.save(); res.json(chat); }
  catch (e) { res.status(500).json({ error: "Failed" }); }
});

app.delete("/api/chats/:chatId", requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ message: "Deleted" });
  try { await Chat.findByIdAndDelete(req.params.chatId); await UserChat.deleteOne({ chatId: req.params.chatId }); res.json({ message: "Deleted" }); }
  catch (e) { res.status(500).json({ error: "Failed" }); }
});

app.put("/api/chats/:chatId/session", requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ message: "Updated" });
  try { const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.userId }); if (!chat) return res.status(404); chat.sessionId = req.body.sessionId; await chat.save(); res.json({ message: "Updated" }); }
  catch (e) { res.status(500).json({ error: "Failed" }); }
});

app.get("/api/profile", requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ profile: {} });
  try { const user = await User.findById(req.userId).select("gns3Profile"); res.json({ profile: user?.gns3Profile || {} }); }
  catch (e) { res.status(500).json({ error: "Failed" }); }
});

app.put("/api/profile", requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ profile: req.body });
  try { const { version, features, images } = req.body; const user = await User.findById(req.userId); if (!user) return res.status(404); if (!user.gns3Profile) user.gns3Profile = {}; if (version !== undefined) user.gns3Profile.version = version; if (features) user.gns3Profile.features = { ...user.gns3Profile.features, ...features }; if (images) user.gns3Profile.images = images; await user.save(); res.json({ profile: user.gns3Profile }); }
  catch (e) { res.status(500).json({ error: "Failed" }); }
});

/* ================= HEALTH ================= */

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "express", db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

app.get("/api/ai/health", async (req, res) => {
  try {
    const aiRes = await fetch(`${FASTAPI_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (aiRes.ok) return res.json({ status: "ok", service: "fastapi", ...(await aiRes.json().catch(() => ({}))) });
    res.status(502).json({ status: "error", service: "fastapi" });
  } catch (e) { res.status(502).json({ status: "error", service: "fastapi", message: "Cannot reach AI engine" }); }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📡 Proxying /api/ai → ${FASTAPI_URL} (manual fetch proxy)`);
});
