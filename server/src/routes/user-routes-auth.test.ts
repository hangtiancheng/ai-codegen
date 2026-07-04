import { describe, expect, it } from "vitest";
import { ErrorCode } from "../common/index.js";
import { UserRole } from "../generated/prisma/enums.js";
import { buildUser } from "../test-support/index.js";
import {
  buildHarness,
  buildRegularUser,
  jsonRequest,
  loginAndGetCookie,
  parseBody,
} from "./user-routes-utils.js";

describe("user routes - register & login", () => {
  it("registers a new user when account is unique", async () => {
    const { app, db } = buildHarness();
    db.user.findFirst.mockResolvedValueOnce(null);
    db.user.create.mockResolvedValueOnce(buildUser({ id: 99n, userAccount: "alice" }));

    const response = await jsonRequest(app, "/api/user/register", {
      checkPassword: "password123",
      userAccount: "alice",
      userPassword: "password123",
    });

    const body = await parseBody(response);
    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
    expect(body.data).toBe("99");
  });

  it("rejects register with mismatched passwords", async () => {
    const { app } = buildHarness();
    const response = await jsonRequest(app, "/api/user/register", {
      checkPassword: "different123",
      userAccount: "alice",
      userPassword: "password123",
    });
    expect(response.status).toBe(400);
  });

  it("rejects register when account already exists", async () => {
    const { app, db } = buildHarness();
    db.user.findFirst.mockResolvedValueOnce(buildUser({ userAccount: "alice" }));

    const response = await jsonRequest(app, "/api/user/register", {
      checkPassword: "password123",
      userAccount: "alice",
      userPassword: "password123",
    });

    const body = await parseBody(response);
    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.ParamsError);
  });

  it("rejects register payload that fails validation", async () => {
    const { app } = buildHarness();
    const response = await jsonRequest(app, "/api/user/register", {
      checkPassword: "abc",
      userAccount: "ab",
      userPassword: "abc",
    });
    expect(response.status).toBe(400);
  });

  it("logs in and sets a session cookie on success", async () => {
    const { app, db } = buildHarness();
    db.user.findFirst.mockResolvedValueOnce(buildRegularUser({ id: 1n, userAccount: "alice" }));

    const response = await jsonRequest(app, "/api/user/login", {
      userAccount: "alice",
      userPassword: "password123",
    });
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
    expect(response.headers.get("set-cookie")).toContain("ai_codegen_session=");
  });

  it("rejects login with the wrong password", async () => {
    const { app, db } = buildHarness();
    db.user.findFirst.mockResolvedValueOnce(buildRegularUser({ userAccount: "alice" }));

    const response = await jsonRequest(app, "/api/user/login", {
      userAccount: "alice",
      userPassword: "wrong-password",
    });
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.ParamsError);
  });

  it("rejects login when the account does not exist", async () => {
    const { app, db } = buildHarness();
    db.user.findFirst.mockResolvedValueOnce(null);

    const response = await jsonRequest(app, "/api/user/login", {
      userAccount: "ghost",
      userPassword: "password123",
    });
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.ParamsError);
  });

  it("returns the current user profile after login", async () => {
    const { app, db } = buildHarness();
    db.user.findFirst.mockResolvedValueOnce(
      buildRegularUser({
        id: 7n,
        userAccount: "alice",
        userRole: UserRole.USER,
      }),
    );
    const cookie = await loginAndGetCookie(app, "alice", "password123");

    const response = await app.request("/api/user/get/login", {
      headers: { Cookie: cookie },
    });
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
  });

  it("rejects /get/login when no session cookie is present", async () => {
    const { app } = buildHarness();
    const response = await app.request("/api/user/get/login");
    const body = await parseBody(response);
    expect(response.status).toBe(401);
    expect(body.code).toBe(ErrorCode.NotLoginError);
  });
});
