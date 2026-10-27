import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes.js";
import meetingRoutes from "./routes/meeting.routes.js";
import taskRoutes from "./routes/task.routes.js";
import { notFound, errorHandler } from "./middleware/error.js";
import aiRoutes from "./routes/ai.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import boardRoutes from "./routes/board.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import oauthRoutes from "./routes/oauth.routes.js";
import recordingRoutes from "./routes/recording.routes.js";
import userRoutes from "./routes/user.routes.js";
import inviteRoutes from "./routes/invite.routes.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/meetings", meetingRoutes);
app.use("/api/v1/meetings", aiRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use("/api/v1/workspaces", workspaceRoutes);
app.use("/api/v1/boards", boardRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/auth", oauthRoutes);
app.use("/api/v1/meetings", recordingRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/meetings", inviteRoutes);


app.use(notFound);

app.use(errorHandler);

app.set("trust proxy", 1); // Render sits behind one proxy, so use the visitor's real IP

export default app;
