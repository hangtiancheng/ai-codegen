import { describe, expect, it } from "vitest";
import { CodegenType } from "@/generated/prisma/enums";
import { ErrorCode } from "../common/index";
import { buildApp } from "../test-support/index";
import {
  buildHarness,
  buildRegularUser,
  jsonRequest,
  loginAndGetCookie,
  parseBody,
} from "./user-routes-utils";

const userLogin = async () => {
  const harness = buildHarness();
  const owner = buildRegularUser({ id: 1n, userAccount: "user1" });
  harness.db.user.findFirst.mockResolvedValueOnce(owner);
  const cookie = await loginAndGetCookie(harness.app, owner.userAccount, "password123");
  harness.db.user.findFirst.mockReset();
  return { ...harness, cookie, owner };
};

describe("app routes - deploy", () => {
  it("deploys an owned app and persists deploy metadata", async () => {
    const { app, cookie, db } = await userLogin();
    db.app.findFirst.mockResolvedValueOnce(
      buildApp({
        codegenType: CodegenType.MULTI_FILES,
        deployKey: "abc123",
        id: 9n,
        userId: 1n,
      }),
    );
    db.app.update.mockResolvedValueOnce(buildApp({ deployKey: "abc123", id: 9n }));

    const response = await jsonRequest(app, "/api/app/deploy", { appId: 9 }, cookie);
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.data).toBe("http://localhost:3000/api/dist/abc123/index.html");
    expect(db.app.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deployKey: "abc123" }),
        where: { id: 9n },
      }),
    );
  });

  it("rejects deploy when caller is not the owner", async () => {
    const { app, cookie, db } = await userLogin();
    db.app.findFirst.mockResolvedValueOnce(buildApp({ id: 9n, userId: 2n }));

    const response = await jsonRequest(app, "/api/app/deploy", { appId: "9" }, cookie);
    const body = await parseBody(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe(ErrorCode.NoAuthError);
  });
});
