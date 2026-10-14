import jwt from "jsonwebtoken";
import { signAccess, signRefresh, hashToken } from "../../src/utils/tokens.js";

describe("tokens", () => {
  test("access token verifies with the access secret and carries the user id", () => {
    const payload = jwt.verify(signAccess("user123"), process.env.JWT_ACCESS_SECRET);
    expect(payload.id).toBe("user123");
  });

  test("refresh token does not verify with the access secret", () => {
    expect(() => jwt.verify(signRefresh("user123"), process.env.JWT_ACCESS_SECRET)).toThrow();
  });

  test("two refresh tokens for the same user are different", () => {
    expect(signRefresh("user123")).not.toBe(signRefresh("user123"));
  });

  test("hashToken is a deterministic 64-char hex string", () => {
    const h = hashToken("abc");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken("abc")).toBe(h);
    expect(hashToken("abd")).not.toBe(h);
  });
});
