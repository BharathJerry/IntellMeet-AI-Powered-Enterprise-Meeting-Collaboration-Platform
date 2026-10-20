import "dotenv/config";
import http from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import { initSocket } from "./socket/index.js";

const port = process.env.PORT || 5000;
const server = http.createServer(app);
const io = initSocket(server);

async function start() {
  await connectDB();

  const redis = await connectRedis();
  if (redis) {
    // Lets several server instances share Socket.io rooms and broadcasts
    const sub = redis.duplicate();
    sub.on("error", (e) => console.error("Redis sub error:", e.message));
    await sub.connect();
    io.adapter(createAdapter(redis, sub));
    console.log("Socket.io Redis adapter enabled");
  }

  server.listen(port, () => console.log(`API + sockets running on :${port}`));
}

start().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
