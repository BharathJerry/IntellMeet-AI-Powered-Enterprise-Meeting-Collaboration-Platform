import request from "supertest";
import mongoose from "mongoose";
import app from "../../src/app.js";
import Meeting from "../../src/models/Meeting.js";
import { sendDueReminders } from "../../src/jobs/reminders.js";

const run = process.env.MONGO_URI_TEST ? describe : describe.skip;

run("Invites, team sharing and scheduling", () => {
  let alice, bob, carol, meetingId, code;
  const soon = new Date(Date.now() + 5 * 60 * 1000);
  const call = (method, path, user) => request(app)[method](`/api/v1${path}`).set({ Authorization: `Bearer ${user.token}` });
  const signup = async (name, email) => {
    const r = await request(app).post("/api/v1/auth/signup").send({ name, email, password: "password123" });
    return { token: r.body.accessToken, id: r.body.user.id };
  };

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST, { dbName: "intellmeet_test_invite" });
    if (!/test/i.test(mongoose.connection.name)) throw new Error("Refusing to run: test database name must contain 'test'");
    await mongoose.connection.dropDatabase();
    alice = await signup("Alice Tester", "alice@test.com");
    bob = await signup("Bob Tester", "bob@test.com");
    carol = await signup("Carol Tester", "carol@test.com");
    const m = await call("post", "/meetings", alice).send({ title: "Planning", scheduledAt: soon.toISOString() });
    meetingId = m.body.meeting._id;
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  describe("invite links", () => {
    test("a scheduled time is stored", async () => {
      const m = await call("get", `/meetings/${meetingId}`, alice);
      expect(new Date(m.body.meeting.scheduledAt).getTime()).toBe(soon.getTime());
    });

    test("members get a stable invite code; outsiders cannot create one", async () => {
      const a = await call("post", `/meetings/${meetingId}/invite`, alice);
      expect(a.status).toBe(200);
      code = a.body.code;
      expect(code.length).toBeGreaterThanOrEqual(6);
      expect((await call("post", `/meetings/${meetingId}/invite`, alice)).body.code).toBe(code);
      expect((await call("post", `/meetings/${meetingId}/invite`, bob)).status).toBe(403);
    });

    test("anyone logged in can preview and join with the code", async () => {
      const preview = await call("get", `/meetings/invite/${code}`, carol);
      expect(preview.body.meeting.title).toBe("Planning");
      expect((await call("get", "/meetings/invite/not-a-code", carol)).status).toBe(404);

      expect((await call("get", `/meetings/${meetingId}`, carol)).status).toBe(403); // not yet a member
      const join = await call("post", `/meetings/invite/${code}/join`, carol);
      expect(join.body.meetingId).toBe(meetingId);
      expect((await call("get", `/meetings/${meetingId}`, carol)).status).toBe(200);
    });
  });

  describe("inviting a whole team", () => {
    test("adds every workspace member once, and only from your own workspace", async () => {
      const ws = await call("post", "/workspaces", alice).send({ name: "Engineering" });
      await call("post", `/workspaces/${ws.body.workspace._id}/members`, alice).send({ email: "bob@test.com" });

      const first = await call("post", `/meetings/${meetingId}/invite-workspace`, alice).send({ workspaceId: ws.body.workspace._id });
      expect(first.body.added).toBe(1); // alice is the host, carol is not in the workspace
      expect((await call("get", `/meetings/${meetingId}`, bob)).status).toBe(200);

      const again = await call("post", `/meetings/${meetingId}/invite-workspace`, alice).send({ workspaceId: ws.body.workspace._id });
      expect(again.body.added).toBe(0);

      // carol is in the meeting but not in this workspace
      const outsider = await call("post", `/meetings/${meetingId}/invite-workspace`, carol).send({ workspaceId: ws.body.workspace._id });
      expect(outsider.status).toBe(404);
    });
  });

  describe("reminders", () => {
    test("a meeting starting within 10 minutes is reminded once, and re-armed when rescheduled", async () => {
      await sendDueReminders();
      let m = await Meeting.findById(meetingId);
      expect(m.reminderSentFor.getTime()).toBe(m.scheduledAt.getTime());

      const before = m.reminderSentFor.getTime();
      await sendDueReminders(); // nothing new to send
      m = await Meeting.findById(meetingId);
      expect(m.reminderSentFor.getTime()).toBe(before);

      const later = new Date(Date.now() + 8 * 60 * 1000);
      await call("patch", `/meetings/${meetingId}`, alice).send({ scheduledAt: later.toISOString() });
      await sendDueReminders();
      m = await Meeting.findById(meetingId);
      expect(m.reminderSentFor.getTime()).toBe(later.getTime());
    });
  });
});
