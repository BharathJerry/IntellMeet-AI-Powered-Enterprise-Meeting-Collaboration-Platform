import request from "supertest";
import mongoose from "mongoose";
import app from "../../src/app.js";
import Task from "../../src/models/Task.js";

// Runs only when MONGO_URI_TEST is set. Uses its own database (name contains "test").
const run = process.env.MONGO_URI_TEST ? describe : describe.skip;

run("Workspaces, boards and analytics", () => {
  let alice, bob, carol; // { token, id, email }
  let wsId, boardId, board2Id, taskAId;

  const signup = async (name, email) => {
    const res = await request(app).post("/api/v1/auth/signup").send({ name, email, password: "password123" });
    return { token: res.body.accessToken, id: res.body.user.id, email };
  };
  const call = (method, path, user, body) => {
    const req = request(app)[method](`/api/v1${path}`).set({ Authorization: `Bearer ${user.token}` });
    return body ? req.send(body) : req;
  };

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST, { dbName: "intellmeet_test_workspace" });
    if (!/test/i.test(mongoose.connection.name))
      throw new Error("Refusing to run: test database name must contain 'test'");
    await mongoose.connection.dropDatabase();
    alice = await signup("Alice Tester", "alice@test.com");
    bob = await signup("Bob Tester", "bob@test.com");
    carol = await signup("Carol Tester", "carol@test.com");
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  describe("workspaces and members", () => {
    test("creator becomes the admin member", async () => {
      const res = await call("post", "/workspaces", alice, { name: "Engineering" });
      expect(res.status).toBe(201);
      expect(res.body.workspace.members).toHaveLength(1);
      expect(res.body.workspace.members[0].role).toBe("admin");
      wsId = res.body.workspace._id;
    });

    test("short names are rejected", async () => {
      expect((await call("post", "/workspaces", alice, { name: "x" })).status).toBe(400);
    });

    test("non-members cannot open a workspace", async () => {
      expect((await call("get", `/workspaces/${wsId}`, bob)).status).toBe(403);
    });

    test("admin adds a member by email; unknown and duplicate emails are handled", async () => {
      const ok = await call("post", `/workspaces/${wsId}/members`, alice, { email: bob.email });
      expect(ok.status).toBe(201);
      expect(ok.body.member.role).toBe("member");

      expect((await call("post", `/workspaces/${wsId}/members`, alice, { email: "nobody@test.com" })).status).toBe(404);
      expect((await call("post", `/workspaces/${wsId}/members`, alice, { email: bob.email })).status).toBe(409);
    });

    test("plain members cannot add people", async () => {
      const res = await call("post", `/workspaces/${wsId}/members`, bob, { email: carol.email });
      expect(res.status).toBe(403);
    });

    test("list shows only my workspaces", async () => {
      const forBob = await call("get", "/workspaces", bob);
      expect(forBob.body.workspaces.some((w) => w._id === wsId)).toBe(true);
      const forCarol = await call("get", "/workspaces", carol);
      expect(forCarol.body.workspaces).toHaveLength(0);
    });
  });

  describe("boards and Kanban tasks", () => {
    test("any member can create boards; outsiders cannot view them", async () => {
      const res = await call("post", `/workspaces/${wsId}/boards`, bob, { name: "Sprint 1" });
      expect(res.status).toBe(201);
      boardId = res.body.board._id;

      expect((await call("get", `/boards/${boardId}`, carol)).status).toBe(403);
    });

    test("tasks can only be assigned to workspace members", async () => {
      const bad = await call("post", `/boards/${boardId}/tasks`, alice, { title: "Bad assignee", assignee: carol.id });
      expect(bad.status).toBe(400);

      const a = await call("post", `/boards/${boardId}/tasks`, alice, { title: "Design login page" });
      expect(a.status).toBe(201);
      expect(a.body.task.status).toBe("todo");
      taskAId = a.body.task._id;

      const b = await call("post", `/boards/${boardId}/tasks`, alice, { title: "Write API docs", assignee: bob.id });
      expect(b.status).toBe(201);
    });

    test("board returns tasks grouped into ordered columns", async () => {
      const res = await call("get", `/boards/${boardId}`, bob);
      expect(res.status).toBe(200);
      expect(res.body.columns.todo.map((t) => t.title)).toEqual(["Design login page", "Write API docs"]);
      expect(res.body.columns.todo[1].assignee.name).toBe("Bob Tester");
      expect(res.body.columns.in_progress).toHaveLength(0);
    });

    test("moving a card changes its column", async () => {
      const move = await call("patch", `/boards/${boardId}/tasks/${taskAId}`, bob, { status: "in_progress" });
      expect(move.status).toBe(200);
      expect(move.body.task.status).toBe("in_progress");
      expect(move.body.task.position).toBeGreaterThan(0);

      const board = await call("get", `/boards/${boardId}`, alice);
      expect(board.body.columns.in_progress).toHaveLength(1);
      expect(board.body.columns.todo).toHaveLength(1);
    });

    test("invalid status is rejected, assignee can be cleared", async () => {
      expect((await call("patch", `/boards/${boardId}/tasks/${taskAId}`, alice, { status: "finished" })).status).toBe(400);

      const set = await call("patch", `/boards/${boardId}/tasks/${taskAId}`, alice, { assignee: bob.id });
      expect(set.body.task.assignee.name).toBe("Bob Tester");
      const cleared = await call("patch", `/boards/${boardId}/tasks/${taskAId}`, alice, { assignee: null });
      expect(cleared.body.task.assignee).toBeUndefined();
    });

    test("a task id from another board is not found", async () => {
      const b2 = await call("post", `/workspaces/${wsId}/boards`, alice, { name: "Sprint 2" });
      board2Id = b2.body.board._id;
      const res = await call("patch", `/boards/${board2Id}/tasks/${taskAId}`, alice, { status: "done" });
      expect(res.status).toBe(404);
    });
  });

  describe("analytics", () => {
    test("overview returns counts and a 14-day series", async () => {
      const res = await call("get", "/analytics/overview", alice);
      expect(res.status).toBe(200);
      expect(res.body.meetings.perDay).toHaveLength(14);
      expect(res.body.tasks.total).toBeGreaterThanOrEqual(2);
      expect(Object.keys(res.body.tasks.byStatus)).toEqual(["todo", "in_progress", "done"]);
      expect(res.body.tasks.completionRate).toBeGreaterThanOrEqual(0);
    });

    test("requires authentication", async () => {
      expect((await request(app).get("/api/v1/analytics/overview")).status).toBe(401);
    });
  });

  describe("cleanup rules", () => {
    test("only admins can delete a board, and its tasks go with it", async () => {
      expect((await call("delete", `/boards/${boardId}`, bob)).status).toBe(403);
      expect((await call("delete", `/boards/${boardId}`, alice)).status).toBe(204);
      expect(await Task.countDocuments({ board: boardId })).toBe(0);
    });

    test("the owner cannot be removed; members can be", async () => {
      expect((await call("delete", `/workspaces/${wsId}/members/${alice.id}`, alice)).status).toBe(400);
      expect((await call("delete", `/workspaces/${wsId}/members/${bob.id}`, alice)).status).toBe(204);
      expect((await call("get", `/workspaces/${wsId}`, bob)).status).toBe(403);
    });

    test("only the owner can delete the workspace", async () => {
      await call("post", `/workspaces/${wsId}/members`, alice, { email: bob.email, role: "admin" });
      expect((await call("delete", `/workspaces/${wsId}`, bob)).status).toBe(403); // admin, but not owner
      expect((await call("delete", `/workspaces/${wsId}`, alice)).status).toBe(204);
      expect((await call("get", `/workspaces/${wsId}`, alice)).status).toBe(404);
    });
  });
});
