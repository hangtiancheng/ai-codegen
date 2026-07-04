import { describe, expect, it } from "vitest";
import {
  loginUserVoSchema,
  userLoginRequestSchema,
  userRegisterRequestSchema,
  userVoSchema,
} from "./user";

describe("userVoSchema", () => {
  it("parses a minimal valid payload", () => {
    const value = userVoSchema.parse({
      id: 1,
      userAccount: "alice",
      userRole: "user",
    });
    expect(value.userAccount).toBe("alice");
  });

  it("normalizes backend id and role values", () => {
    const value = userVoSchema.parse({
      id: "1",
      userAccount: "alice",
      userRole: "USER",
    });

    expect(value.id).toBe("1");
    expect(value.userRole).toBe("user");
  });

  it("rejects unknown role", () => {
    const result = userVoSchema.safeParse({
      id: 1,
      userAccount: "alice",
      userRole: "owner",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginUserVoSchema", () => {
  it("accepts optional updateTime", () => {
    const value = loginUserVoSchema.parse({
      id: 5,
      userAccount: "bob",
      userRole: "admin",
      updateTime: "2026-01-01T00:00:00Z",
    });
    expect(value.updateTime).toBe("2026-01-01T00:00:00Z");
  });

  it("accepts the current-user payload returned by the backend session", () => {
    const value = loginUserVoSchema.parse({
      id: "5",
      userAccount: "bob",
      userAvatar: null,
      username: "Bob",
      userProfile: null,
      userRole: "ADMIN",
    });

    expect(value.username).toBe("Bob");
    expect(value.userRole).toBe("admin");
  });
});

describe("userLoginRequestSchema", () => {
  it("requires minimum lengths", () => {
    const result = userLoginRequestSchema.safeParse({
      userAccount: "abc",
      userPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("userRegisterRequestSchema", () => {
  it("rejects mismatched passwords", () => {
    const result = userRegisterRequestSchema.safeParse({
      userAccount: "alice",
      userPassword: "password1",
      checkPassword: "password2",
    });
    expect(result.success).toBe(false);
  });

  it("accepts matching passwords", () => {
    const value = userRegisterRequestSchema.parse({
      userAccount: "alice",
      userPassword: "password1",
      checkPassword: "password1",
    });
    expect(value.userAccount).toBe("alice");
  });
});
