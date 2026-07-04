import { describe, expect, it } from "vitest";
import { ErrorCode } from "../common/index.js";
import { UserRole } from "../generated/prisma/enums.js";
import { buildUser } from "../test-support/index.js";
import {
  buildAdmin,
  buildHarness,
  buildRegularUser,
  jsonRequest,
  loginAndGetCookie,
  parseBody,
} from "./user-routes-utils.js";

const adminLogin = async () => {
  const harness = buildHarness();
  const admin = buildAdmin({ id: 1n, userAccount: "admin" });
  harness.db.user.findFirst.mockResolvedValueOnce(admin);
  const cookie = await loginAndGetCookie(harness.app, "admin", "password123");
  return { ...harness, admin, cookie };
};

describe("user routes - admin endpoints", () => {
  it("rejects /add when caller is not authenticated", async () => {
    const { app } = buildHarness();
    const response = await jsonRequest(app, "/api/user/add", {
      userAccount: "newbie",
      userPassword: "password123",
    });
    const body = await parseBody(response);
    expect(response.status).toBe(401);
    expect(body.code).toBe(ErrorCode.NotLoginError);
  });

  it("rejects /add when caller is not an admin", async () => {
    const harness = buildHarness();
    harness.db.user.findFirst.mockResolvedValueOnce(
      buildRegularUser({
        id: 1n,
        userAccount: "alice",
        userRole: UserRole.USER,
      }),
    );
    const cookie = await loginAndGetCookie(harness.app, "alice", "password123");

    const response = await jsonRequest(
      harness.app,
      "/api/user/add",
      { userAccount: "newbie", userPassword: "password123" },
      cookie,
    );
    const body = await parseBody(response);
    expect(response.status).toBe(403);
    expect(body.code).toBe(ErrorCode.NoAuthError);
  });

  it("admin can /add a new user", async () => {
    const { app, db, cookie } = await adminLogin();
    db.user.create.mockResolvedValueOnce(buildUser({ id: 200n, userAccount: "newbie" }));

    const response = await jsonRequest(
      app,
      "/api/user/add",
      {
        userAccount: "newbie",
        userPassword: "password123",
        userRole: UserRole.USER,
      },
      cookie,
    );
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
    expect(body.data).toBe("200");
  });

  it("admin can /get a raw user-compatible record", async () => {
    const { app, db, cookie } = await adminLogin();
    db.user.findFirst.mockReset();
    db.user.findFirst.mockResolvedValueOnce(buildUser({ id: 5n, userAccount: "target" }));

    const response = await app.request("/api/user/get?id=5", {
      headers: { Cookie: cookie },
    });
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
    expect(body.data).toEqual(
      expect.objectContaining({
        id: "5",
        userAccount: "target",
        userPassword: expect.any(String),
      }),
    );
  });

  it("rejects /get when caller is not an admin", async () => {
    const harness = buildHarness();
    harness.db.user.findFirst.mockResolvedValueOnce(
      buildRegularUser({ id: 1n, userAccount: "alice" }),
    );
    const cookie = await loginAndGetCookie(harness.app, "alice", "password123");

    const response = await harness.app.request("/api/user/get?id=5", {
      headers: { Cookie: cookie },
    });
    const body = await parseBody(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe(ErrorCode.NoAuthError);
  });

  it("admin /update returns 404 when target user is missing", async () => {
    const { app, db, cookie } = await adminLogin();
    db.user.findFirst.mockReset();
    db.user.findFirst.mockResolvedValueOnce(null);

    const response = await jsonRequest(
      app,
      "/api/user/update",
      { id: "999", username: "renamed" },
      cookie,
    );
    const body = await parseBody(response);

    expect(response.status).toBe(404);
    expect(body.code).toBe(ErrorCode.NotFoundError);
  });

  it("admin can /delete an existing user", async () => {
    const { app, db, cookie } = await adminLogin();
    db.user.findFirst.mockReset();
    db.user.findFirst.mockResolvedValueOnce(buildUser({ id: 5n }));
    db.user.update.mockResolvedValueOnce(buildUser({ id: 5n, isDelete: true }));

    const response = await jsonRequest(app, "/api/user/delete", { id: "5" }, cookie);
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
    expect(body.data).toBe(true);
  });

  it("admin /list/page/vo returns paginated user records", async () => {
    const { app, db, cookie } = await adminLogin();
    db.user.findMany.mockResolvedValueOnce([
      buildUser({ id: 10n, userAccount: "u1" }),
      buildUser({ id: 11n, userAccount: "u2" }),
    ]);
    db.user.count.mockResolvedValueOnce(2);

    const response = await jsonRequest(
      app,
      "/api/user/list/page/vo",
      { current: 1, pageSize: 10 },
      cookie,
    );
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
  });

  it("rejects /get/vo when id is malformed", async () => {
    const { app } = buildHarness();
    const response = await app.request("/api/user/get/vo?id=not-a-number");
    expect(response.status).toBe(400);
  });

  it("logout clears the session cookie", async () => {
    const harness = buildHarness();
    harness.db.user.findFirst.mockResolvedValueOnce(
      buildRegularUser({ id: 1n, userAccount: "alice" }),
    );
    const cookie = await loginAndGetCookie(harness.app, "alice", "password123");

    const response = await harness.app.request("/api/user/logout", {
      headers: { Cookie: cookie },
      method: "POST",
    });
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.data).toBe(true);
  });
});
