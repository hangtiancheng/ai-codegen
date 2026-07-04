import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword } from "../common/index.js";
import { env } from "../config/index.js";
import { buildHarness, buildRegularUser, jsonRequest } from "./user-routes-utils.js";

const legacyHash = (plain: string): string =>
  createHash("md5")
    .update(plain + env.PASSWORD_SALT)
    .digest("hex");

describe("user routes - password upgrade", () => {
  it("rehashes legacy passwords after successful login", async () => {
    const { app, db } = buildHarness();
    db.user.findFirst.mockResolvedValueOnce(
      buildRegularUser({
        id: 1n,
        userAccount: "alice",
        userPassword: legacyHash("password123"),
      }),
    );

    const response = await jsonRequest(app, "/api/user/login", {
      userAccount: "alice",
      userPassword: "password123",
    });

    expect(response.status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userPassword: expect.stringMatching(/^scrypt\$v1\$/u),
      }),
      where: { id: 1n },
    });
  });

  it("does not rehash current password hashes after successful login", async () => {
    const { app, db } = buildHarness();
    db.user.findFirst.mockResolvedValueOnce(
      buildRegularUser({
        id: 1n,
        userAccount: "alice",
        userPassword: hashPassword("password123"),
      }),
    );

    const response = await jsonRequest(app, "/api/user/login", {
      userAccount: "alice",
      userPassword: "password123",
    });

    expect(response.status).toBe(200);
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
