import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { env } from "../config/index.js";
import { hashPassword, verifyPasswordWithUpgrade } from "./crypto.js";

const legacyHash = (plain: string): string =>
  createHash("md5")
    .update(plain + env.PASSWORD_SALT)
    .digest("hex");

describe("password crypto", () => {
  it("hashes new passwords with scrypt", () => {
    const hashed = hashPassword("password123");

    expect(hashed.startsWith("scrypt$v1$")).toBe(true);
    expect(verifyPasswordWithUpgrade("password123", hashed)).toEqual({
      needsRehash: false,
      valid: true,
    });
  });

  it("accepts legacy MD5 hashes and marks them for rehash", () => {
    expect(verifyPasswordWithUpgrade("password123", legacyHash("password123"))).toEqual({
      needsRehash: true,
      valid: true,
    });
  });

  it("rejects invalid hashes", () => {
    expect(verifyPasswordWithUpgrade("password123", legacyHash("wrong-password"))).toEqual({
      needsRehash: true,
      valid: false,
    });
  });
});
