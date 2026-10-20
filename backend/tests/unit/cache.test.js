import { jest } from "@jest/globals";

// A fake Redis client backed by a Map, so these tests need no Redis server
const store = new Map();
const fakeRedis = {
  get: jest.fn(async (k) => store.get(k) ?? null),
  set: jest.fn(async (k, v) => {
    store.set(k, v);
  }),
  del: jest.fn(async (k) => {
    store.delete(k);
  }),
};
let redisAvailable = true;

jest.unstable_mockModule("../../src/config/redis.js", () => ({
  getRedis: () => (redisAvailable ? fakeRedis : null),
}));

const { getCachedMeeting, cacheMeeting, invalidateMeeting } = await import("../../src/utils/cache.js");

beforeEach(() => {
  store.clear();
  redisAvailable = true;
  jest.clearAllMocks();
});

describe("meeting cache", () => {
  test("miss returns null", async () => {
    expect(await getCachedMeeting("abc")).toBeNull();
  });

  test("stores and returns a meeting, with a 60 second expiry", async () => {
    await cacheMeeting("abc", { title: "Sprint", host: "u1" });
    expect(fakeRedis.set).toHaveBeenCalledWith("meeting:abc", expect.any(String), { EX: 60 });
    expect(await getCachedMeeting("abc")).toEqual({ title: "Sprint", host: "u1" });
  });

  test("invalidate removes the entry", async () => {
    await cacheMeeting("abc", { title: "Sprint" });
    await invalidateMeeting("abc");
    expect(await getCachedMeeting("abc")).toBeNull();
  });

  test("without Redis everything is a safe no-op", async () => {
    redisAvailable = false;
    await expect(cacheMeeting("abc", { a: 1 })).resolves.toBeUndefined();
    await expect(invalidateMeeting("abc")).resolves.toBeUndefined();
    expect(await getCachedMeeting("abc")).toBeNull();
  });

  test("a Redis error is swallowed instead of breaking the request", async () => {
    fakeRedis.get.mockRejectedValueOnce(new Error("connection lost"));
    expect(await getCachedMeeting("abc")).toBeNull();
  });
});
