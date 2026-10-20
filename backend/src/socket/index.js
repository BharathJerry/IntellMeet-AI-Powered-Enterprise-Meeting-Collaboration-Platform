import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Meeting from "../models/Meeting.js";
import Message from "../models/Message.js";
import { invalidateMeeting } from "../utils/cache.js";

let io;

const roomName = (id) => `meeting:${id}`;

// Participants are stored on each socket's `data`; fetchSockets() also sees sockets on other servers
async function participantsOf(id) {
  const sockets = await io.in(roomName(id)).fetchSockets();
  return sockets.filter((s) => s.data.participant).map((s) => s.data.participant);
}

// Use from REST controllers: notifyUser(userId, "task:assigned", {...})
export const notifyUser = (userId, event, payload) =>
  io?.to(`user:${userId}`).emit(event, payload);

// Wraps every handler: always acks, never lets an async error crash the process
const handle = (fn) => async (payload, ack) => {
  const cb = typeof ack === "function" ? ack : () => {};
  try {
    const result = await fn(payload || {});
    cb({ ok: true, ...result });
  } catch (err) {
    cb({ ok: false, error: err.message });
  }
};

function leaveMeeting(socket) {
  const id = socket.data.meetingId;
  if (!id) return;
  socket.leave(roomName(id));
  socket.to(roomName(id)).emit("participant:left", {
    socketId: socket.id,
    userId: socket.user.id,
  });
  socket.data.meetingId = null;
  socket.data.participant = null;
}

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL, credentials: true },
  });

  // Authenticate during the handshake: client connects with io(url, { auth: { token } })
  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(payload.id);
      if (!user) throw new Error("no user");
      socket.user = { id: user.id, name: user.name };
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`); // personal room for notifications

    socket.on(
      "meeting:join",
      handle(async ({ meetingId }) => {
        if (!mongoose.isValidObjectId(meetingId)) throw new Error("Invalid meeting id");
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) throw new Error("Meeting not found");

        const uid = socket.user.id;
        const isHost = meeting.host.equals(uid);
        const allowed = isHost || meeting.participants.some((p) => p.equals(uid));
        if (!allowed) throw new Error("Join the meeting first");
        if (meeting.status === "ended") throw new Error("Meeting has ended");

        leaveMeeting(socket); // only one meeting per socket
        if (isHost && meeting.status === "scheduled") {
          meeting.status = "live";
          await meeting.save();
          await invalidateMeeting(meeting.id);
        }

        const id = meeting.id;
        const me = { socketId: socket.id, userId: uid, name: socket.user.name, muted: false, videoOff: false };
        const existing = await participantsOf(id); // snapshot before adding self

        socket.data.meetingId = id; // server-side truth; later events never trust client ids
        socket.data.participant = me;
        socket.join(roomName(id));
        socket.to(roomName(id)).emit("participant:joined", me);

        const history = await Message.find({ meeting: id }).sort({ createdAt: -1 }).limit(50);
        return {
          participants: existing, // new joiner sends WebRTC offers to these
          messages: history.reverse().map((m) => ({
            id: m.id,
            senderId: m.sender,
            senderName: m.senderName,
            text: m.text,
            createdAt: m.createdAt,
          })),
        };
      })
    );

    socket.on("meeting:leave", handle(async () => leaveMeeting(socket)));

    // WebRTC signaling relay: offer / answer / ICE candidates go peer -> server -> peer
    socket.on(
      "signal",
      handle(async ({ to, data }) => {
        const id = socket.data.meetingId;
        if (!id) throw new Error("Peer not in your meeting");

        // fast path for peers on this server (ICE candidates arrive in bursts), slower lookup for other servers
        const local = io.sockets.sockets.get(to);
        const inMeeting = local
          ? local.data.meetingId === id
          : (await io.in(roomName(id)).fetchSockets()).some((s) => s.id === to);
        if (!inMeeting) throw new Error("Peer not in your meeting");

        io.to(to).emit("signal", { from: socket.id, data });
      })
    );

    socket.on(
      "chat:message",
      handle(async ({ text }) => {
        const id = socket.data.meetingId;
        const clean = typeof text === "string" ? text.trim().slice(0, 2000) : "";
        if (!id) throw new Error("Not in a meeting");
        if (!clean) throw new Error("Empty message");

        const msg = await Message.create({
          meeting: id,
          sender: socket.user.id,
          senderName: socket.user.name,
          text: clean,
        });
        io.to(roomName(id)).emit("chat:message", {
          id: msg.id,
          senderId: socket.user.id,
          senderName: socket.user.name,
          text: msg.text,
          createdAt: msg.createdAt,
        });
      })
    );

    socket.on(
      "chat:typing",
      handle(async ({ isTyping }) => {
        const id = socket.data.meetingId;
        if (!id) return;
        socket.to(roomName(id)).emit("chat:typing", {
          userId: socket.user.id,
          name: socket.user.name,
          isTyping: !!isTyping,
        });
      })
    );

    socket.on(
      "media:state",
      handle(async ({ muted, videoOff }) => {
        const id = socket.data.meetingId;
        const me = socket.data.participant;
        if (!id || !me) throw new Error("Not in a meeting");
        if (typeof muted === "boolean") me.muted = muted;
        if (typeof videoOff === "boolean") me.videoOff = videoOff;
        socket.to(roomName(id)).emit("media:state", {
          socketId: socket.id,
          muted: me.muted,
          videoOff: me.videoOff,
        });
      })
    );

    socket.on("disconnecting", () => leaveMeeting(socket));
  });

  return io;
}
