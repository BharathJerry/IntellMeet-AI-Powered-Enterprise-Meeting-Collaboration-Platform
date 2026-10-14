import request from "supertest";
import mongoose from "mongoose";
import app from "../../src/app.js";

// Runs only when MONGO_URI_TEST is set (use a DB whose name contains "test")
const run = process.env.MONGO_URI_TEST ? describe : describe.skip;

const waitFor = async (fn, tries = 20) => {
  for (let i = 0; i < tries; i++) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Timed out waiting for condition");
};

run("API integration", () => {
  const alice = { name: "Alice Tester", email: "alice@test.com", password: "password123" };
  const bob = { name: "Bob Tester", email: "bob@test.com", password: "password123" };
  const auth = (t) => ({ Authorization: `Bearer ${t}` });

  let tokenA, tokenB, refreshA, idA, meetingId, taskId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST);
    if (!/test/i.test(mongoose.connection.name))
      throw new Error("Refusing to run: test database name must contain 'test'");
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  describe("auth", () => {
    test("health check", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
    });

    test("signup rejects invalid input", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({ email: "bad" });
      expect(res.status).toBe(400);
    });

    test("signup succeeds and never returns the password", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send(alice);
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(JSON.stringify(res.body)).not.toContain("password");
      tokenA = res.body.accessToken;
      refreshA = res.body.refreshToken;
      idA = res.body.user.id;

      const resB = await request(app).post("/api/v1/auth/signup").send(bob);
      tokenB = resB.body.accessToken;
    });

    test("duplicate email returns 409", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send(alice);
      expect(res.status).toBe(409);
    });

    test("login fails with a wrong password, works with the right one", async () => {
      const bad = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: alice.email, password: "wrongpass1" });
      expect(bad.status).toBe(401);

      const ok = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: alice.email, password: alice.password });
      expect(ok.status).toBe(200);
      tokenA = ok.body.accessToken;
      refreshA = ok.body.refreshToken;
    });

    test("/me requires a token", async () => {
      expect((await request(app).get("/api/v1/auth/me")).status).toBe(401);
      const res = await request(app).get("/api/v1/auth/me").set(auth(tokenA));
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(alice.email);
    });

    test("refresh rotates the token and rejects the old one", async () => {
      const first = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: refreshA });
      expect(first.status).toBe(200);

      const reuse = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: refreshA });
      expect(reuse.status).toBe(401);

      tokenA = first.body.accessToken;
    });
  });

  describe("meetings", () => {
    test("creating a meeting requires auth", async () => {
      const res = await request(app).post("/api/v1/meetings").send({ title: "Sprint review" });
      expect(res.status).toBe(401);
    });

    test("host can create and fetch a meeting", async () => {
      const res = await request(app)
        .post("/api/v1/meetings")
        .set(auth(tokenA))
        .send({ title: "Sprint review" });
      expect(res.status).toBe(201);
      meetingId = res.body.meeting._id;

      const get = await request(app).get(`/api/v1/meetings/${meetingId}`).set(auth(tokenA));
      expect(get.status).toBe(200);
    });

    test("non-members get 403 until they join", async () => {
      const before = await request(app).get(`/api/v1/meetings/${meetingId}`).set(auth(tokenB));
      expect(before.status).toBe(403);

      const join = await request(app).post(`/api/v1/meetings/${meetingId}/join`).set(auth(tokenB));
      expect(join.status).toBe(200);

      const after = await request(app).get(`/api/v1/meetings/${meetingId}`).set(auth(tokenB));
      expect(after.status).toBe(200);
    });

    test("only the host can edit", async () => {
      const asB = await request(app)
        .patch(`/api/v1/meetings/${meetingId}`)
        .set(auth(tokenB))
        .send({ title: "Hacked" });
      expect(asB.status).toBe(403);

      const asA = await request(app)
        .patch(`/api/v1/meetings/${meetingId}`)
        .set(auth(tokenA))
        .send({ title: "Sprint review v2" });
      expect(asA.status).toBe(200);
      expect(asA.body.meeting.title).toBe("Sprint review v2");
    });

    test("list returns the user's meetings; bad and unknown ids are handled", async () => {
      const list = await request(app).get("/api/v1/meetings").set(auth(tokenA));
      expect(list.status).toBe(200);
      expect(list.body.meetings.length).toBeGreaterThanOrEqual(1);

      expect((await request(app).get("/api/v1/meetings/not-an-id").set(auth(tokenA))).status).toBe(400);
      expect(
        (await request(app).get("/api/v1/meetings/507f1f77bcf86cd799439011").set(auth(tokenA))).status
      ).toBe(404);
    });
  });

  describe("tasks", () => {
    test("create, list and update with permissions", async () => {
      const create = await request(app)
        .post("/api/v1/tasks")
        .set(auth(tokenA))
        .send({ title: "Write README" });
      expect(create.status).toBe(201);
      taskId = create.body.task._id;

      const list = await request(app).get("/api/v1/tasks").set(auth(tokenA));
      expect(list.body.tasks.some((t) => t._id === taskId)).toBe(true);

      const stranger = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set(auth(tokenB))
        .send({ status: "done" });
      expect(stranger.status).toBe(403);

      const invalid = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set(auth(tokenA))
        .send({ status: "finished" });
      expect(invalid.status).toBe(400);

      const ok = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set(auth(tokenA))
        .send({ status: "done" });
      expect(ok.body.task.status).toBe("done");
    });

    test("creator can delete", async () => {
      const res = await request(app).delete(`/api/v1/tasks/${taskId}`).set(auth(tokenA));
      expect(res.status).toBe(204);
    });
  });

  describe("AI summary flow (mock mode)", () => {
    const post = (path, token, body) =>
      request(app).post(`/api/v1/meetings/${meetingId}${path}`).set(auth(token)).send(body);

    test("summarize needs a transcript first", async () => {
      const empty = await request(app).post("/api/v1/meetings").set(auth(tokenA)).send({ title: "Empty" });
      const res = await request(app)
        .post(`/api/v1/meetings/${empty.body.meeting._id}/summarize`)
        .set(auth(tokenA));
      expect(res.status).toBe(400);
    });

    test("members add transcript lines", async () => {
      expect((await post("/transcript", tokenA, { text: "Alice will send the report. I will book the demo room." })).status).toBe(201);
      expect((await post("/transcript", tokenB, { text: "Bob needs to fix the login bug." })).status).toBe(201);
      expect((await post("/transcript", tokenA, { text: "" })).status).toBe(400);
    });

    test("only the host can summarize", async () => {
      expect((await post("/summarize", tokenB)).status).toBe(403);
    });

    test("host summarizes; job finishes with assigned action items", async () => {
      const start = await post("/summarize", tokenA);
      expect(start.status).toBe(202);

      const done = await waitFor(async () => {
        const r = await request(app).get(`/api/v1/meetings/${meetingId}/summary`).set(auth(tokenA));
        return r.body.aiStatus === "done" ? r.body : null;
      });

      expect(done.actionItems).toHaveLength(3);
      expect(done.actionItems[0].assignee).toBe(idA); // "Alice" matched to Alice Tester
    });

    test("convert creates tasks once, never duplicates", async () => {
      const first = await post("/action-items/convert", tokenA);
      expect(first.status).toBe(201);
      expect(first.body.tasks).toHaveLength(3);

      const second = await post("/action-items/convert", tokenA);
      expect(second.body.tasks).toHaveLength(0);
    });
  });
});
