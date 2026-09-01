import { resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { validateRelativePath } from "../src/agent-runtime/project-files.js";
import { ErrorCode, HttpError } from "../src/common/index.js";

// Security-critical path guard. These tests pin the exact allow/deny behavior of
// the client-supplied path validator that every file-mutation endpoint relies on.
const BASE = "/tmp/swifty-project";
const RESOLVED_BASE = resolve(BASE);

describe("validateRelativePath - valid input", () => {
  it("resolves a simple nested file inside the base", () => {
    const target = validateRelativePath(BASE, "src/App.tsx");
    expect(target).toBe(`${RESOLVED_BASE}${sep}src${sep}App.tsx`);
    expect(target.startsWith(`${RESOLVED_BASE}${sep}`)).toBe(true);
  });

  it("resolves a top-level file", () => {
    expect(validateRelativePath(BASE, "package.json")).toBe(`${RESOLVED_BASE}${sep}package.json`);
  });

  it("resolves deeply nested paths", () => {
    expect(validateRelativePath(BASE, "a/b/c/d.ts")).toBe(
      `${RESOLVED_BASE}${sep}a${sep}b${sep}c${sep}d.ts`,
    );
  });

  it("trims surrounding whitespace before validating", () => {
    expect(validateRelativePath(BASE, "  src/index.ts  ")).toBe(
      `${RESOLVED_BASE}${sep}src${sep}index.ts`,
    );
  });

  it("matches forbidden names by exact segment, not substring", () => {
    // "distances", "builder", "my.env.ts" contain forbidden tokens as substrings
    // but are NOT forbidden segments, so they must be allowed.
    expect(validateRelativePath(BASE, "src/distances.ts")).toBe(
      `${RESOLVED_BASE}${sep}src${sep}distances.ts`,
    );
    expect(validateRelativePath(BASE, "builder/main.ts")).toBe(
      `${RESOLVED_BASE}${sep}builder${sep}main.ts`,
    );
    expect(validateRelativePath(BASE, "config/my.env.ts")).toBe(
      `${RESOLVED_BASE}${sep}config${sep}my.env.ts`,
    );
    expect(validateRelativePath(BASE, ".gitignore")).toBe(`${RESOLVED_BASE}${sep}.gitignore`);
  });
});

describe("validateRelativePath - rejects empty", () => {
  it.each(["", "   ", "\t\n"])("throws ParamsError for %j", (input) => {
    try {
      validateRelativePath(BASE, input);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe(ErrorCode.ParamsError);
      expect((error as HttpError).message).toBe("Path cannot be empty");
    }
  });
});

describe("validateRelativePath - rejects backslashes", () => {
  it.each(["a\\b", "src\\App.tsx", "..\\..\\etc"])("throws for %j", (input) => {
    const run = () => validateRelativePath(BASE, input);
    expect(run).toThrow(HttpError);
    expect(run).toThrow("Backslashes are not allowed in paths");
  });
});

describe("validateRelativePath - rejects absolute paths", () => {
  it.each(["/etc/passwd", "/", "/tmp/x"])("throws for %j", (input) => {
    try {
      validateRelativePath(BASE, input);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe(ErrorCode.ParamsError);
      expect((error as HttpError).message).toBe("Absolute paths are not allowed");
    }
  });
});

describe("validateRelativePath - rejects '.'/'..' and empty segments (traversal)", () => {
  it.each(["..", "../secret", "a/../b", "a/./b", "./src", "a//b", "src/..", "../../etc/passwd"])(
    "throws traversal error for %j",
    (input) => {
      try {
        validateRelativePath(BASE, input);
        throw new Error("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).code).toBe(ErrorCode.ParamsError);
        expect((error as HttpError).message).toBe("Path traversal is not allowed");
      }
    },
  );
});

describe("validateRelativePath - rejects forbidden segments", () => {
  it.each([
    ".git",
    ".git/config",
    "src/.git/hooks",
    ".swifty",
    ".swifty/commands",
    ".env",
    "config/.env",
    "node_modules",
    "node_modules/react/index.js",
    "dist",
    "dist/bundle.js",
    "build",
    "app/build/output",
  ])("throws ForbiddenError (403) for %j", (input) => {
    try {
      validateRelativePath(BASE, input);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe(ErrorCode.ForbiddenError);
      expect((error as HttpError).statusCode).toBe(403);
      expect((error as HttpError).message).toContain("Path segment is not allowed");
    }
  });

  it("reports the specific offending segment in the message", () => {
    try {
      validateRelativePath(BASE, "src/node_modules/x.js");
      throw new Error("expected throw");
    } catch (error) {
      expect((error as HttpError).message).toBe("Path segment is not allowed: node_modules");
    }
  });
});

describe("validateRelativePath - traversal check precedes forbidden check", () => {
  it("treats '..' before a forbidden segment as a traversal (ParamsError), not forbidden", () => {
    try {
      validateRelativePath(BASE, "../node_modules/x");
      throw new Error("expected throw");
    } catch (error) {
      expect((error as HttpError).code).toBe(ErrorCode.ParamsError);
      expect((error as HttpError).message).toBe("Path traversal is not allowed");
    }
  });
});
