import { describe, expect, it } from "vitest";
import { ErrorCode, HttpError } from "../../common/index.js";
import { CodegenType } from "../../generated/prisma/enums.js";
import {
  createCodegenTypeRouter,
  type RouteMessages,
  type RouteModelInvoker,
} from "./codegen-type-router.js";

const buildRouter = (content: string) => {
  const calls: RouteMessages[] = [];
  const model: RouteModelInvoker = {
    invoke: async (messages) => {
      calls.push(messages);
      return { content };
    },
  };
  return { calls, router: createCodegenTypeRouter(model) };
};

describe("codegen type router", () => {
  it("returns a structured CodegenType from model JSON", async () => {
    const { calls, router } = buildRouter(
      JSON.stringify({ codegenType: CodegenType.VITE_PROJECT }),
    );

    await expect(router.routeCodegenType("Build a React app")).resolves.toBe(
      CodegenType.VITE_PROJECT,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1].content).toBe("Build a React app");
  });

  it("returns a structured CodegenType from fenced model JSON", async () => {
    const { router } = buildRouter('```json\n{"codegenType":"VITE_PROJECT"}\n```');

    await expect(router.routeCodegenType("Build a React app")).resolves.toBe(
      CodegenType.VITE_PROJECT,
    );
  });

  it("rejects plain text model output", async () => {
    const { router } = buildRouter("VITE_PROJECT");

    await expect(router.routeCodegenType("Build a React app")).rejects.toMatchObject({
      code: ErrorCode.OperationError,
    });
  });

  it("rejects unknown model route values", async () => {
    const { router } = buildRouter(JSON.stringify({ codegenType: "UNKNOWN" }));

    await expect(router.routeCodegenType("Build something")).rejects.toBeInstanceOf(HttpError);
  });

  it("rejects ambiguous model output with multiple route fields", async () => {
    const { router } = buildRouter(
      JSON.stringify({
        codegenType: CodegenType.VANILLA_HTML,
        alternateCodegenType: CodegenType.VITE_PROJECT,
      }),
    );

    await expect(router.routeCodegenType("Build something")).rejects.toMatchObject({
      code: ErrorCode.OperationError,
    });
  });
});
