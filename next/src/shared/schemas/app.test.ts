import { describe, expect, it } from "vitest";
import { appAddRequestSchema, appAdminUpdateRequestSchema, appVoSchema } from "./app";

describe("appVoSchema", () => {
  it("parses a valid app", () => {
    const value = appVoSchema.parse({
      id: 1,
      appName: "Demo",
      initPrompt: "Build a portfolio",
      codegenType: "VANILLA_HTML",
      userId: 2,
    });
    expect(value.appName).toBe("Demo");
  });

  it("normalizes backend id and codegen values", () => {
    const value = appVoSchema.parse({
      id: "1",
      appName: "Demo",
      appCover: null,
      initPrompt: "Build a portfolio",
      codegenType: "VITE_PROJECT",
      userId: "2",
    });

    expect(value.id).toBe("1");
    expect(value.codegenType).toBe("VITE_PROJECT");
    expect(value.userId).toBe("2");
  });

  it("normalizes legacy app payload fields", () => {
    const value = appVoSchema.parse({
      id: 1,
      appName: "Legacy Demo",
      appCover: "https://example.com/cover.png",
      initPrompt: "Build a portfolio",
      codegenType: "VITE_PROJECT",
      userId: 2,
    });

    expect(value.appCover).toBe("https://example.com/cover.png");
    expect(value.codegenType).toBe("VITE_PROJECT");
  });

  it("normalizes backend deployTime while ignoring null deployment time", () => {
    const value = appVoSchema.parse({
      id: 1,
      appName: "Fresh App",
      appCover: null,
      initPrompt: "Build a portfolio",
      codegenType: "VANILLA_HTML",
      deployKey: "abcde",
      deployTime: null,
      userId: 2,
    });

    expect(value.deployKey).toBe("abcde");
    expect(value.deployTime).toBeNull();
  });

  it("rejects unknown codegen type", () => {
    const result = appVoSchema.safeParse({
      id: 1,
      appName: "Demo",
      initPrompt: "Build",
      // TODO: vue_project
      codegenType: "vue_project",
      userId: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive ids", () => {
    const result = appVoSchema.safeParse({
      id: 0,
      appName: "Demo",
      initPrompt: "Build",
      codegenType: "VANILLA_HTML",
      userId: 2,
    });
    expect(result.success).toBe(false);
  });
});

describe("appAddRequestSchema", () => {
  it("requires non-empty initPrompt", () => {
    const result = appAddRequestSchema.safeParse({ initPrompt: "" });
    expect(result.success).toBe(false);
  });

  it("keeps the legacy 1000 character prompt limit", () => {
    const result = appAddRequestSchema.safeParse({
      initPrompt: "a".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

describe("appAdminUpdateRequestSchema", () => {
  it("permits id-only updates", () => {
    const value = appAdminUpdateRequestSchema.parse({ id: 1 });
    expect(value.id).toBe("1");
  });

  it("validates cover url", () => {
    const result = appAdminUpdateRequestSchema.safeParse({
      id: 1,
      appCover: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
