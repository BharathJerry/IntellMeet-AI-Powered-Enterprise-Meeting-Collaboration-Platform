// Usage: node scripts/load-http.js <baseUrl> [users=20] [seconds=30]
// Needs Node 18+ (built-in fetch). No extra packages.
import { writeFileSync } from "node:fs";

const [base = "http://localhost:5000", u = "20", s = "30"] = process.argv.slice(2);
const USERS = Number(u), SECONDS = Number(s);
const url = (p) => `${base.replace(/\/$/, "")}${p}`;

const pct = (arr, p) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))] : 0);
const post = (path, body, token) =>
  fetch(url(`/api/v1${path}`), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

// one login for the whole test, so the auth rate limiter is not what we measure
let res = await post("/auth/signup", { name: "Load Test", email: "loadtest@intellmeet.app", password: "LoadTest123" });
if (res.status === 409) res = await post("/auth/login", { email: "loadtest@intellmeet.app", password: "LoadTest123" });
const token = (await res.json()).accessToken;
if (!token) throw new Error(`Could not log in (status ${res.status}). Is the API awake and reachable?`);

const stats = {}; // name -> { ms: [], ok: 0, fail: 0, errors: {} }
const record = (name, ms, status, err) => {
  const st = (stats[name] ??= { ms: [], ok: 0, fail: 0, errors: {} });
  if (err || status >= 400) { st.fail++; const k = err || `HTTP ${status}`; st.errors[k] = (st.errors[k] || 0) + 1; }
  else { st.ok++; st.ms.push(ms); }
};

const call = async (name, path, opts = {}) => {
  const t0 = performance.now();
  try {
    const r = await fetch(url(path), { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    await r.arrayBuffer();
    record(name, performance.now() - t0, r.status);
  } catch (e) { record(name, performance.now() - t0, 0, e.cause?.code || e.message); }
};

const actions = [
  () => call("GET /health", "/health"),
  () => call("GET /meetings", "/api/v1/meetings?limit=10"),
  () => call("GET /analytics/overview", "/api/v1/analytics/overview"),
  () => call("GET /meetings", "/api/v1/meetings?limit=10"),
];

const stopAt = Date.now() + SECONDS * 1000;
const started = performance.now();
await Promise.all(Array.from({ length: USERS }, async () => {
  while (Date.now() < stopAt) {
    if (Math.random() < 0.05) await call("POST /meetings", "/api/v1/meetings", { method: "POST", body: JSON.stringify({ title: "Load test meeting" }) });
    else await actions[Math.floor(Math.random() * actions.length)]();
  }
}));
const elapsed = (performance.now() - started) / 1000;

const rows = Object.entries(stats).map(([name, st]) => ({
  endpoint: name, requests: st.ok + st.fail, failed: st.fail,
  p50_ms: Math.round(pct(st.ms, 50)), p95_ms: Math.round(pct(st.ms, 95)), p99_ms: Math.round(pct(st.ms, 99)), max_ms: Math.round(Math.max(0, ...st.ms)),
  errors: st.errors,
}));
const total = rows.reduce((a, r) => a + r.requests, 0), failed = rows.reduce((a, r) => a + r.failed, 0);
const summary = { target: base, users: USERS, seconds: Math.round(elapsed), total_requests: total, requests_per_second: +(total / elapsed).toFixed(1), failed, success_rate_percent: +(((total - failed) / total) * 100).toFixed(2), endpoints: rows };

console.table(rows.map(({ errors, ...r }) => r));
console.log(`\n${USERS} users, ${summary.seconds}s: ${total} requests, ${summary.requests_per_second} req/s, ${summary.success_rate_percent}% success`);
for (const r of rows) if (r.failed) console.log(`Errors on ${r.endpoint}:`, r.errors);
writeFileSync("load-http-results.json", JSON.stringify(summary, null, 2));
console.log("Saved load-http-results.json");
