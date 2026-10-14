import "dotenv/config";

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET ||= "test_access_secret";
process.env.JWT_REFRESH_SECRET ||= "test_refresh_secret";
process.env.AI_MODE = "mock"; // tests never call a real AI provider

// Integration tests use their own database, never your real one
if (process.env.MONGO_URI_TEST) process.env.MONGO_URI = process.env.MONGO_URI_TEST;
