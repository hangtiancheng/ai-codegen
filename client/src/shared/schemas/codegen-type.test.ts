import { describe, expect, it } from "vitest";
import { codegenTypeSchema, formatCodegenType } from "./codegen-type";

describe("codegenTypeSchema", () => {
  it("accepts known values", () => {
    expect(codegenTypeSchema.parse("VANILLA_HTML")).toBe("VANILLA_HTML");
    expect(codegenTypeSchema.parse("MULTI_FILES")).toBe("MULTI_FILES");
    expect(codegenTypeSchema.parse("VITE_PROJECT")).toBe("VITE_PROJECT");
  });

  it("rejects unknown value", () => {
    const result = codegenTypeSchema.safeParse("vue_project");
    expect(result.success).toBe(false);
  });
});

describe("formatCodegenType", () => {
  it("maps each value to its label", () => {
    expect(formatCodegenType("VANILLA_HTML")).toBe("Vanilla HTML");
    expect(formatCodegenType("MULTI_FILES")).toBe("Multi-files");
    expect(formatCodegenType("VITE_PROJECT")).toBe("Vite Project");
  });
});
