import "dotenv/config";
import mongoose from "mongoose";

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  console.log("OK");
} catch (e) {
  console.log("Main error:", e.message);
  for (const [host, s] of e.reason?.servers ?? [])
    console.log(host, "->", s.error?.message ?? s.type);
}
process.exit();