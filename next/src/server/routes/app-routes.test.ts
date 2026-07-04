import { describe, expect, it } from "vitest";
import { CodegenType } from "@/generated/prisma/enums";
import { ErrorCode } from "../common/index";
import { buildApp } from "../test-support/index";
import {
  buildAdmin,
  buildHarness,
  buildRegularUser,
  jsonRequest,
  loginAndGetCookie,
  parseBody,
} from "./user-routes-utils";

const userLogin = async (id: bigint) => {
  const harness = buildHarness();
  const owner = buildRegularUser({ id, userAccount: `user${String(id)}` });
  harness.db.user.findFirst.mockResolvedValueOnce(owner);
  const cookie = await loginAndGetCookie(harness.app, owner.userAccount, "password123");
  harness.db.user.findFirst.mockReset();
  return { ...harness, cookie, owner };
};

describe("app routes - lifecycle", () => {
  it("rejects /add when caller is not authenticated", async () => {
    const { app } = buildHarness();
    const response = await jsonRequest(app, "/api/app/add", {
      initPrompt: "build me a site",
    });
    const body = await parseBody(response);
    expect(response.status).toBe(401);
    expect(body.code).toBe(ErrorCode.NotLoginError);
  });

  it("authenticated user can /add an app", async () => {
    const { app, db, cookie } = await userLogin(1n);
    db.app.create.mockResolvedValueOnce(buildApp({ id: 100n, userId: 1n }));

    const response = await jsonRequest(
      app,
      "/api/app/add",
      { initPrompt: "build a vite project for me" },
      cookie,
    );
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
    expect(body.data).toBe("100");
    expect(db.app.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        codegenType: CodegenType.VITE_PROJECT,
        initPrompt: "build a vite project for me",
        userId: 1n,
      }),
    });
  });

  it("rejects /update when caller is not the owner", async () => {
    const { app, db, cookie } = await userLogin(1n);
    db.app.findFirst.mockResolvedValueOnce(buildApp({ id: 9n, userId: 2n }));

    const response = await jsonRequest(
      app,
      "/api/app/update",
      { appName: "renamed", id: "9" },
      cookie,
    );
    const body = await parseBody(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe(ErrorCode.NoAuthError);
  });

  it("owner can /update their app", async () => {
    const { app, db, cookie } = await userLogin(1n);
    db.app.findFirst.mockResolvedValueOnce(buildApp({ id: 9n, userId: 1n }));
    db.app.update.mockResolvedValueOnce(buildApp({ appName: "renamed", id: 9n, userId: 1n }));

    const response = await jsonRequest(
      app,
      "/api/app/update",
      { appName: "renamed", id: "9" },
      cookie,
    );
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.data).toBe(true);
  });

  it("rejects /delete when caller is not the owner", async () => {
    const { app, db, cookie } = await userLogin(1n);
    db.app.findFirst.mockResolvedValueOnce(buildApp({ id: 9n, userId: 2n }));

    const response = await jsonRequest(app, "/api/app/delete", { id: "9" }, cookie);
    const body = await parseBody(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe(ErrorCode.NoAuthError);
  });

  it("returns 404 when /update target app is missing", async () => {
    const { app, db, cookie } = await userLogin(1n);
    db.app.findFirst.mockResolvedValueOnce(null);

    const response = await jsonRequest(
      app,
      "/api/app/update",
      { appName: "renamed", id: "999" },
      cookie,
    );
    const body = await parseBody(response);

    expect(response.status).toBe(404);
    expect(body.code).toBe(ErrorCode.NotFoundError);
  });

  it("public /get/vo returns the app VO without authentication", async () => {
    const { app, db } = buildHarness();
    db.app.findFirst.mockResolvedValueOnce(buildApp({ id: 9n, userId: 2n }));

    const response = await app.request("/api/app/get/vo?id=9");
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
  });

  it("rejects /get/vo when id is malformed", async () => {
    const { app } = buildHarness();
    const response = await app.request("/api/app/get/vo?id=not-a-number");
    expect(response.status).toBe(400);
  });

  it("admin can adminUpdate an existing app", async () => {
    const harness = buildHarness();
    const admin = buildAdmin({ id: 1n, userAccount: "admin" });
    harness.db.user.findFirst.mockResolvedValueOnce(admin);
    const cookie = await loginAndGetCookie(harness.app, "admin", "password123");
    harness.db.app.findFirst.mockResolvedValueOnce(buildApp({ id: 9n, userId: 2n }));
    harness.db.app.update.mockResolvedValueOnce(buildApp({ id: 9n, priority: 99 }));

    const response = await jsonRequest(
      harness.app,
      "/api/app/admin/update",
      { id: "9", priority: 99 },
      cookie,
    );
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.data).toBe(true);
  });

  it("non-admin is rejected from /admin/list/page/vo", async () => {
    const { app, cookie } = await userLogin(1n);

    const response = await jsonRequest(app, "/api/app/admin/list/page/vo", { current: 1 }, cookie);
    const body = await parseBody(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe(ErrorCode.NoAuthError);
  });

  it("/awesome/list/page/vo is public and forces priority filter", async () => {
    const { app, db } = buildHarness();
    db.app.findMany.mockResolvedValueOnce([buildApp({ id: 1n, priority: 99 })]);
    db.app.count.mockResolvedValueOnce(1);

    const response = await jsonRequest(app, "/api/app/awesome/list/page/vo", {
      current: 1,
      pageSize: 5,
    });
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
    expect(db.app.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isDelete: false, priority: 99 }),
      }),
    );
  });
});
