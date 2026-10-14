import { jest } from "@jest/globals";
import { z } from "zod";
import { validate, validId } from "../../src/middleware/validate.js";
import { errorHandler } from "../../src/middleware/error.js";
import { AppError } from "../../src/utils/AppError.js";

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("validate", () => {
  const schema = z.object({ email: z.string().email() });

  test("passes valid data through", () => {
    const req = { body: { email: "a@b.com", extra: "dropped" } };
    const next = jest.fn();
    validate(schema)(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: "a@b.com" }); // unknown keys stripped
  });

  test("rejects invalid data with a 400 AppError", () => {
    const next = jest.fn();
    validate(schema)({ body: { email: "nope" } }, {}, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
  });
});

describe("validId", () => {
  test("accepts a valid ObjectId", () => {
    const next = jest.fn();
    validId()({ params: { id: "507f1f77bcf86cd799439011" } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  test("rejects a malformed id", () => {
    const next = jest.fn();
    validId()({ params: { id: "<meeting id>" } }, {}, next);
    expect(next.mock.calls[0][0].status).toBe(400);
  });
});

describe("errorHandler", () => {
  test("returns AppError status and message", () => {
    const res = mockRes();
    errorHandler(new AppError("Forbidden", 403), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Forbidden" });
  });

  test("hides internal details on unexpected errors", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = mockRes();
    errorHandler(new Error("db password leaked"), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe("Internal server error");
  });

  test("maps duplicate key errors to 409", () => {
    const res = mockRes();
    errorHandler({ code: 11000 }, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
