import request from "supertest";
import mongoose from "mongoose";
import app from "../../src/app.js";

const run = process.env.MONGO_URI_TEST ? describe : describe.skip;
const binary = (res, cb) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

run("Recordings, avatar and Google login", () => {
  let alice, bob, meetingId;
  const call = (method, path, user) => request(app)[method](`/api/v1${path}`).set({ Authorization: `Bearer ${user.token}` });
  const signup = async (name, email) => {
    const r = await request(app).post("/api/v1/auth/signup").send({ name, email, password: "password123" });
    return { token: r.body.accessToken };
  };
  const video = Buffer.from("fake-webm-bytes-for-testing");

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST, { dbName: "intellmeet_test_extras" });
    if (!/test/i.test(mongoose.connection.name)) throw new Error("Refusing to run: test database name must contain 'test'");
    await mongoose.connection.dropDatabase();
    alice = await signup("Alice Tester", "alice@test.com");
    bob = await signup("Bob Tester", "bob@test.com");
    meetingId = (await call("post", "/meetings", alice).send({ title: "Recorded meeting" })).body.meeting._id;
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  describe("recordings", () => {
    test("non-members cannot upload or list", async () => {
      expect((await call("post", `/meetings/${meetingId}/recordings`, bob).set("Content-Type", "video/webm").send(video)).status).toBe(403);
      expect((await call("get", `/meetings/${meetingId}/recordings`, bob)).status).toBe(403);
    });

    test("a wrong content type is rejected", async () => {
      const res = await call("post", `/meetings/${meetingId}/recordings`, alice).set("Content-Type", "text/plain").send("hello");
      expect(res.status).toBe(400);
    });

    let rid;
    test("members upload and list a recording", async () => {
      const up = await call("post", `/meetings/${meetingId}/recordings`, alice).set("Content-Type", "video/webm").send(video);
      expect(up.status).toBe(201);
      rid = up.body.recording.id;

      const list = await call("get", `/meetings/${meetingId}/recordings`, alice);
      expect(list.body.recordings).toHaveLength(1);
      expect(list.body.recordings[0].by).toBe("Alice Tester");
    });

    test("download returns the same bytes, and only to members", async () => {
      const ok = await call("get", `/meetings/${meetingId}/recordings/${rid}`, alice).buffer(true).parse(binary);
      expect(ok.status).toBe(200);
      expect(ok.body.equals(video)).toBe(true);
      expect((await call("get", `/meetings/${meetingId}/recordings/${rid}`, bob)).status).toBe(403);
    });
  });

  describe("profile", () => {
    test("name can be changed; too-short names are rejected", async () => {
      expect((await call("patch", "/users/me", alice).send({ name: "Alice B" })).body.user.name).toBe("Alice B");
      expect((await call("patch", "/users/me", alice).send({ name: "x" })).status).toBe(400);
    });

    test("avatar accepts a real JPEG and rejects anything else", async () => {
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const ok = await call("put", "/users/me/avatar", alice).set("Content-Type", "image/jpeg").send(jpeg);
      expect(ok.status).toBe(200);
      expect(ok.body.user.avatar.startsWith("data:image/jpeg;base64,")).toBe(true);

      const fake = await call("put", "/users/me/avatar", alice).set("Content-Type", "image/jpeg").send(Buffer.from("not an image"));
      expect(fake.status).toBe(400);
      const png = await call("put", "/users/me/avatar", alice).set("Content-Type", "image/png").send(jpeg);
      expect(png.status).toBe(400);
    });
  });

  describe("google login", () => {
    const post = () => request(app).post("/api/v1/auth/google").send({ credential: "x".repeat(30) });
    afterEach(() => { delete process.env.GOOGLE_CLIENT_ID; });

    test("says so when Google login is not configured", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      expect((await post()).status).toBe(501);
    });

    test("rejects a token that Google cannot verify", async () => {
      process.env.GOOGLE_CLIENT_ID = "test.apps.googleusercontent.com";
      expect((await post()).status).toBe(401);
    });
  });
});
