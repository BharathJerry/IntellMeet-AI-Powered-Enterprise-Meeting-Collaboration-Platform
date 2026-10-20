import { getRedis } from "../config/redis.js";

const TTL_SECONDS = 60; // safety net: even if an invalidation is missed, data is stale for at most a minute
const key = (id) => `meeting:${id}`;

// Every helper is fail-safe: if Redis is missing or errors, caching is simply skipped.
export async function getCachedMeeting(id) {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const value = await redis.get(key(id));
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function cacheMeeting(id, meeting) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key(id), JSON.stringify(meeting), { EX: TTL_SECONDS });
  } catch {
    /* ignore */
  }
}

export async function invalidateMeeting(id) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key(id));
  } catch {
    /* ignore */
  }
}
