import { createClient } from "redis";

let client = null;

// Redis is optional: without REDIS_URL (or if it is down) the app runs exactly as before.
export async function connectRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log("Redis disabled (REDIS_URL not set)");
    return null;
  }
  try {
    const c = createClient({
      url,
      socket: {
        connectTimeout: 5000,
        // retry with backoff, give up after 20 attempts so startup never hangs forever
        reconnectStrategy: (n) => (n > 20 ? new Error("Redis retry limit reached") : Math.min(n * 200, 3000)),
      },
    });
    c.on("error", (e) => console.error("Redis error:", e.message));
    await c.connect();
    client = c;
    console.log("Redis connected");
  } catch (e) {
    console.error("Redis unavailable, continuing without it:", e.message);
    client = null;
  }
  return client;
}

// Returns a ready client, or null so callers can skip caching
export const getRedis = () => (client?.isReady ? client : null);
