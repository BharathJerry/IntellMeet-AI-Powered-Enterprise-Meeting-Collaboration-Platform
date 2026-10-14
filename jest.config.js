export default {
  testEnvironment: "node",
  transform: {}, // project uses native ES modules, so no Babel
  setupFiles: ["<rootDir>/tests/setup.js"],
  testMatch: ["**/tests/**/*.test.js"],
  testTimeout: 30000,
};
