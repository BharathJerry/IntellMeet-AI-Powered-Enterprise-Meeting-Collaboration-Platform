import http from "http";
import request from "supertest";
import mongoose from "mongoose";
import { io as Client } from "socket.io-client";
import app from "../../src/app.js";
import { initSocket, notifyUser } from "../../src/socket/index.js";
import Message from "../../src/models/Message.js";

// Runs only when MONGO_URI_TEST is set. Uses its own database (name contains "test").
const run = process.env.MONGO_URI_TEST ? describe : describe.skip;

// Resolve when `event` arrives and passes the predicate (ignores stray earlier events)
const next = (socket, event, predicate = () => true, ms = 3000) =>
  new Promise((resolve, reject) => {
    const handler = (data) => {
      if (!predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, ms);
    socket.on(event, handler);
  });

// Emit with an acknowledgement callback and return the server's reply
const emit = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

run("Socket.io real-time layer", () => {
  let server, io, url;
  const clients = [];
  const auth = (t) => ({ Authorization: `Bearer ${t}` });

  const connect = (token) =>
    new Promise((resolve, reject) => {
      const socket = Client(url, { auth: { token }, transports: ["websocket"], forceNew: true });
      clients.push(socket);
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", (err) => {
        socket.close();
        reject(err);
      });
    });

  const signup = async (name, email) => {
    const res = await request(app).post("/api/v1/auth/signup").send({ name, email, password: "password123" });
    return { token: res.body.accessToken, id: res.body.user.id };
  };

  let alice, bob, carol; // { token, id }
  let meetingId, sa, sb, sc; // sockets for alice (host), bob (member), carol (outsider)

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST, { dbName: "intellmeet_test_socket" });
    if (!/test/i.test(mongoose.connection.name))
      throw new Error("Refusing to run: test database name must contain 'test'");
    await mongoose.connection.dropDatabase();

    server = http.createServer(app);
    io = initSocket(server);
    await new Promise((r) => server.listen(0, r));
    url = `http://localhost:${server.address().port}`;

    alice = await signup("Alice Tester", "alice@test.com");
    bob = await signup("Bob Tester", "bob@test.com");
    carol = await signup("Carol Tester", "carol@test.com");

    const m = await request(app).post("/api/v1/meetings").set(auth(alice.token)).send({ title: "Socket meeting" });
    meetingId = m.body.meeting._id;
    await request(app).post(`/api/v1/meetings/${meetingId}/join`).set(auth(bob.token)); // bob is a participant, carol is not
  });

  afterAll(async () => {
    clients.forEach((c) => c.close());
    await new Promise((r) => io.close(r));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  describe("connection auth", () => {
    test("rejects a connection with no token", async () => {
      await expect(connect(undefined)).rejects.toThrow("Unauthorized");
    });

    test("rejects a connection with a bad token", async () => {
      await expect(connect("garbage")).rejects.toThrow("Unauthorized");
    });

    test("accepts valid tokens", async () => {
      sa = await connect(alice.token);
      sb = await connect(bob.token);
      sc = await connect(carol.token);
      expect(sa.connected && sb.connected && sc.connected).toBe(true);
    });
  });

  describe("joining", () => {
    test("rejects an invalid meeting id", async () => {
      const res = await emit(sa, "meeting:join", { meetingId: "<meeting id>" });
      expect(res).toEqual({ ok: false, error: "Invalid meeting id" });
    });

    test("rejects users who are not members", async () => {
      const res = await emit(sc, "meeting:join", { meetingId });
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Join the meeting first");
    });

    test("chat requires being in a meeting", async () => {
      const res = await emit(sc, "chat:message", { text: "hello?" });
      expect(res).toEqual({ ok: false, error: "Not in a meeting" });
    });

    test("host joins: meeting goes live and participant list is empty", async () => {
      const res = await emit(sa, "meeting:join", { meetingId });
      expect(res.ok).toBe(true);
      expect(res.participants).toEqual([]);

      const get = await request(app).get(`/api/v1/meetings/${meetingId}`).set(auth(alice.token));
      expect(get.body.meeting.status).toBe("live");
    });

    test("member joins: sees the host, and the host is notified", async () => {
      const joined = next(sa, "participant:joined", (p) => p.userId === bob.id);
      const res = await emit(sb, "meeting:join", { meetingId });

      expect(res.ok).toBe(true);
      expect(res.participants).toHaveLength(1);
      expect(res.participants[0].userId).toBe(alice.id);

      const event = await joined;
      expect(event.name).toBe("Bob Tester");
    });
  });

  describe("chat", () => {
    test("message is broadcast to everyone in the room and saved", async () => {
      const toBob = next(sb, "chat:message", (m) => m.text === "Hello team");
      const toAlice = next(sa, "chat:message", (m) => m.text === "Hello team");

      const ack = await emit(sa, "chat:message", { text: "  Hello team  " }); // trimmed by the server
      expect(ack.ok).toBe(true);

      const received = await toBob;
      await toAlice;
      expect(received.senderName).toBe("Alice Tester");
      expect(await Message.countDocuments({ meeting: meetingId })).toBe(1);
    });

    test("empty messages are rejected", async () => {
      const res = await emit(sa, "chat:message", { text: "   " });
      expect(res).toEqual({ ok: false, error: "Empty message" });
    });

    test("very long messages are cut to 2000 characters", async () => {
      const got = next(sb, "chat:message", (m) => m.text.length === 2000);
      await emit(sa, "chat:message", { text: "x".repeat(2500) });
      expect((await got).text).toHaveLength(2000);
    });

    test("a new connection receives chat history on join", async () => {
      const bob2 = await connect(bob.token);
      const res = await emit(bob2, "meeting:join", { meetingId });
      expect(res.ok).toBe(true);
      expect(res.messages.length).toBeGreaterThanOrEqual(2);
      expect(res.messages[0].text).toBe("Hello team"); // oldest first

      // closing this second tab removes it from the room
      // (save the id first: a closed client socket clears its own id)
      const bob2Id = bob2.id;
      const left = next(sa, "participant:left", (p) => p.socketId === bob2Id);
      bob2.close();
      await left;
    });

    test("typing indicator reaches other participants", async () => {
      const typing = next(sa, "chat:typing", (t) => t.userId === bob.id);
      await emit(sb, "chat:typing", { isTyping: true });
      const event = await typing;
      expect(event.isTyping).toBe(true);
      expect(event.name).toBe("Bob Tester");
    });
  });

  describe("presence and signaling", () => {
    test("media state changes are broadcast", async () => {
      const state = next(sa, "media:state", (s) => s.socketId === sb.id);
      const ack = await emit(sb, "media:state", { muted: true, videoOff: false });
      expect(ack.ok).toBe(true);
      expect(await state).toMatchObject({ muted: true, videoOff: false });
    });

    test("WebRTC signals are relayed to the target peer only", async () => {
      const got = next(sb, "signal", (s) => s.from === sa.id);
      const ack = await emit(sa, "signal", { to: sb.id, data: { type: "offer", sdp: "fake" } });
      expect(ack.ok).toBe(true);
      expect((await got).data.type).toBe("offer");
    });

    test("signals to someone outside the meeting are refused", async () => {
      const res = await emit(sa, "signal", { to: sc.id, data: { type: "offer" } });
      expect(res).toEqual({ ok: false, error: "Peer not in your meeting" });
    });

    test("leaving notifies the room", async () => {
      const left = next(sa, "participant:left", (p) => p.socketId === sb.id);
      await emit(sb, "meeting:leave", {});
      expect((await left).userId).toBe(bob.id);
    });

    test("disconnecting notifies the room", async () => {
      const bob3 = await connect(bob.token);
      await emit(bob3, "meeting:join", { meetingId });
      const bob3Id = bob3.id; // save before closing: a closed client socket clears its id
      const left = next(sa, "participant:left", (p) => p.socketId === bob3Id);
      bob3.close();
      await left;
    });
  });

  describe("notifications and ended meetings", () => {
    test("notifyUser delivers an event to that user's sockets", async () => {
      const got = next(sa, "task:assigned");
      notifyUser(alice.id, "task:assigned", { title: "Write README" });
      expect(await got).toEqual({ title: "Write README" });
    });

    test("cannot join a meeting that has ended", async () => {
      await request(app)
        .patch(`/api/v1/meetings/${meetingId}`)
        .set(auth(alice.token))
        .send({ status: "ended" });
      const res = await emit(sb, "meeting:join", { meetingId });
      expect(res).toEqual({ ok: false, error: "Meeting has ended" });
    });
  });
});
