import { io } from "socket.io-client";
import { API, api, getSession } from "./api.js";
import { toast } from "./toast.js";

let socket = null;

export function startSocket() {
  if (socket) return socket;
  socket = io(API, { auth: (cb) => cb({ token: getSession()?.accessToken }) });

  // an expired token makes the handshake fail: any API call refreshes it, then socket.io retries
  socket.on("connect_error", () => api("/meetings?limit=1").catch(() => {}));

  socket.on("task:assigned", (d) => toast(`📌 New task assigned: ${d.title}`));
  socket.on("summary:ready", (d) =>
    d.status === "done" ? toast("🧠 Your meeting summary is ready") : toast("⚠️ Meeting summary failed", "bad"));
  socket.on("workspace:invited", (d) => toast(`👥 You were added to ${d.name}`));
  // pages that show boards listen for this and reload
  socket.on("board:update", (d) => window.dispatchEvent(new CustomEvent("board-update", { detail: d })));
  return socket;
}

export function stopSocket() {
  socket?.disconnect();
  socket = null;
}
