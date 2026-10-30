// Usage: node scripts/load-sockets.js <baseUrl> [connections=20] [messages=10]
// Opens many Socket.io connections into one meeting and measures join time and chat fan-out latency.
import { io } from "socket.io-client";
import { writeFileSync } from "node:fs";

const [base = "http://localhost:5000", n = "20", m = "10"] = process.argv.slice(2);
const N = Number(n), M = Number(m);
const root = base.replace(/\/$/, "");

const pct = (arr, p) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))] : 0);
const stat = (arr) => ({ count: arr.length, p50_ms: Math.round(pct(arr, 50)), p95_ms: Math.round(pct(arr, 95)), max_ms: Math.round(Math.max(0, ...arr)) });
const post = (path, body, token) =>
  fetch(`${root}/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

let res = await post("/auth/signup", { name: "Socket Load", email: "socketload@intellmeet.app", password: "LoadTest123" });
if (res.status === 409) res = await post("/auth/login", { email: "socketload@intellmeet.app", password: "LoadTest123" });
const token = (await res.json()).accessToken;
if (!token) throw new Error(`Could not log in (status ${res.status}). Is the API awake and reachable?`);
const meetingId = (await (await post("/meetings", { title: "Socket load test" }, token)).json()).meeting._id;

// 1) connect N sockets (all with the same account, which the server allows)
const sockets = [], connectMs = [];
let connectFailed = 0;
await Promise.all(Array.from({ length: N }, async () => {
  const t0 = performance.now();
  const s = io(root, { auth: { token }, transports: ["websocket"], forceNew: true, reconnection: false });
  try {
    await new Promise((ok, fail) => { s.on("connect", ok); s.on("connect_error", fail); setTimeout(() => fail(new Error("timeout")), 20000); });
    connectMs.push(performance.now() - t0);
    sockets.push(s);
  } catch { connectFailed++; s.close(); }
}));

// 2) join the meeting room
const joinMs = [];
let joinFailed = 0;
await Promise.all(sockets.map(async (s) => {
  const t0 = performance.now();
  const ack = await new Promise((ok) => { s.emit("meeting:join", { meetingId }, ok); setTimeout(() => ok({ ok: false }), 20000); });
  ack.ok ? joinMs.push(performance.now() - t0) : joinFailed++;
}));

// 3) chat fan-out: one message must reach every connection
const fanMs = [];
let delivered = 0, expected = 0;
for (let i = 0; i < M && sockets.length; i++) {
  const text = `load-${Date.now()}-${i}`;
  const t0 = performance.now();
  const waits = sockets.map((s) => new Promise((ok) => {
    const h = (msg) => { if (msg.text === text) { s.off("chat:message", h); ok(performance.now() - t0); } };
    s.on("chat:message", h);
    setTimeout(() => { s.off("chat:message", h); ok(null); }, 8000);
  }));
  sockets[0].emit("chat:message", { text }, () => {});
  const got = await Promise.all(waits);
  expected += sockets.length;
  got.filter((x) => x !== null).forEach((x) => { delivered++; fanMs.push(x); });
  await new Promise((r) => setTimeout(r, 200));
}

const summary = {
  target: base, requested_connections: N, connected: sockets.length, connect_failed: connectFailed, join_failed: joinFailed,
  connect: stat(connectMs), join: stat(joinMs), chat_fanout: stat(fanMs),
  chat_delivered: `${delivered}/${expected}`, delivery_rate_percent: expected ? +((delivered / expected) * 100).toFixed(2) : 0,
};
console.log(JSON.stringify(summary, null, 2));
writeFileSync("load-sockets-results.json", JSON.stringify(summary, null, 2));
sockets.forEach((s) => s.close());
process.exit(0);
