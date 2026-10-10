import "dotenv/config";
import http from "http";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./socket/index.js";

const port = process.env.PORT || 5000;
const server = http.createServer(app);
initSocket(server);

connectDB()
  .then(() => server.listen(port, () => console.log(`API + sockets running on :${port}`)))
  .catch((err) => {
    console.error("Startup failed:", err.message);
    process.exit(1);
  });
