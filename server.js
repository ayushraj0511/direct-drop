import express from "express";
import { ExpressPeerServer } from "peer";
import { createServer } from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT || 3000);
const TTL = Number(process.env.SESSION_TTL_MS || 30 * 60 * 1000);

app.use(express.json({ limit: "16kb" }));

const sessions = new Map();

function makeCode() {
  let code;
  do {
    code = String(crypto.randomInt(100000, 1000000));
  } while (sessions.has(code));
  return code;
}

function makeToken() {
  return crypto.randomBytes(18).toString("base64url");
}

function cleanup() {
  const now = Date.now();
  for (const [code, session] of sessions) {
    if (session.expiresAt <= now || session.status === "closed") {
      sessions.delete(code);
    }
  }
}
setInterval(cleanup, 60_000).unref();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "direct-drop", time: new Date().toISOString() });
});

app.post("/api/session", (req, res) => {
  cleanup();
  const peerId = typeof req.body?.peerId === "string" ? req.body.peerId.trim() : "";
  if (!peerId || peerId.length > 200) {
    return res.status(400).json({ error: "Invalid peer ID." });
  }

  const code = makeCode();
  const token = makeToken();
  sessions.set(code, {
    peerId,
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + TTL,
    status: "waiting"
  });

  res.json({
    code,
    token,
    expiresAt: sessions.get(code).expiresAt
  });
});

app.post("/api/session/join", (req, res) => {
  cleanup();
  const code = String(req.body?.code || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "Enter a valid 6-digit code." });
  }

  const session = sessions.get(code);
  if (!session) {
    return res.status(404).json({ error: "Code expired or not found." });
  }

  if (session.status === "closed") {
    return res.status(410).json({ error: "This transfer has ended." });
  }

  session.status = "connected";
  res.json({
    peerId: session.peerId,
    expiresAt: session.expiresAt
  });
});

app.post("/api/session/close", (req, res) => {
  const code = String(req.body?.code || "");
  const token = String(req.body?.token || "");
  const session = sessions.get(code);

  if (session && token && crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(session.token)
  )) {
    session.status = "closed";
    sessions.delete(code);
  }

  res.json({ ok: true });
});

app.get("/api/ice", (_req, res) => {
  const iceServers = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
  ];

  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME || "",
      credential: process.env.TURN_CREDENTIAL || ""
    });
  }

  res.json({ iceServers });
});

const peerServer = ExpressPeerServer(httpServer, {
  path: "/",
  allow_discovery: false,
  proxied: true
});

app.use("/peerjs", peerServer);

const dist = path.join(__dirname, "dist");
app.use(express.static(dist));

app.get("*splat", (_req, res) => {
  res.sendFile(path.join(dist, "index.html"));
});

httpServer.listen(PORT, () => {
  console.log(`Direct Drop running at http://localhost:${PORT}`);
});