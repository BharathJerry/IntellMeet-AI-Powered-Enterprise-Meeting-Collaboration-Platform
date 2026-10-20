// Usage:  node scripts/realtime-check.js [portA] [portB]
//   one port  -> checks Socket.io on a single server
//   two ports -> two separate servers sharing Redis: proves the Redis adapter works
import { io } from "socket.io-client";

const [portA = 5000, portB = portA] = process.argv.slice(2);
const urlA = `http://localhost:${portA}`;
const urlB = `http://localhost:${portB}`;

const post = async (path, body, token) => {
  const res = await fetch(`${urlA}/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
};

// Create the test user, or log in if it already exists
async function getUser(name, email) {
  const body = { name, email, password: "password123" };
  let res = await post("/auth/signup", body);
  if (res.status === 409) res = await post("/auth/login", { email, password: body.password });
  if (!res.data.accessToken) throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  return res.data;
}

const connect = (url, token) =>
  new Promise((resolve, reject) => {
    const s = io(url, { auth: { token }, transports: ["websocket"], forceNew: true });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
  });

const emit = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

const waitFor = (socket, event, predicate = () => true, ms = 3000) =>
  new Promise((resolve) => {
    const handler = (data) => {
      if (!predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null); // null = never arrived
    }, ms);
    socket.on(event, handler);
  });

const results = [];
const check = (name, ok) => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
};

try {
  console.log(`Server A: ${urlA}   Server B: ${urlB}${portA === portB ? "  (same server)" : "  (two servers)"}\n`);

  const alice = await getUser("Smoke Alice", "smoke-alice@test.com");
  const bob = await getUser("Smoke Bob", "smoke-bob@test.com");

  const created = await post("/meetings", { title: "Realtime check" }, alice.accessToken);
  const meetingId = created.data.meeting._id;
  await post(`/meetings/${meetingId}/join`, null, bob.accessToken);

  const sa = await connect(urlA, alice.accessToken);
  const sb = await connect(urlB, bob.accessToken);
  check("both users connect with their tokens", sa.connected && sb.connected);

  const hostJoin = await emit(sa, "meeting:join", { meetingId });
  check("host joins the meeting room", hostJoin.ok === true);

  const hostSawBob = waitFor(sa, "participant:joined", (p) => p.userId === bob.user.id);
  const bobJoin = await emit(sb, "meeting:join", { meetingId });
  check("member sees the host already in the room (presence)", bobJoin.ok && bobJoin.participants.some((p) => p.userId === alice.user.id));
  check("host is told when the member joins", (await hostSawBob) !== null);

  const text = `hello ${Date.now()}`;
  const bobGotChat = waitFor(sb, "chat:message", (m) => m.text === text);
  await emit(sa, "chat:message", { text });
  check("chat message sent by host reaches the member", (await bobGotChat) !== null);

  const hostGotSignal = waitFor(sa, "signal", (s) => s.from === sb.id);
  await emit(sb, "signal", { to: sa.id, data: { type: "offer" } });
  check("WebRTC signal from member reaches host", (await hostGotSignal) !== null);

  sa.close();
  sb.close();
} catch (err) {
  console.log("ERROR:", err.message);
  results.push(false);
}

console.log(results.every(Boolean) ? "\nAll checks passed" : "\nSome checks FAILED");
process.exit(results.every(Boolean) ? 0 : 1);
