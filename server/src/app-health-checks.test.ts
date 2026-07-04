import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { AiModelRegistry } from "./ai/index.js";
import { createModelProviderHealthCheck } from "./app-health-checks.js";

const createRegistry = (model: BaseChatModel): AiModelRegistry => ({
  createModel: () => model,
});

describe("app health checks", () => {
  it("reports model provider up when route model responds", async () => {
    const model = mockDeep<BaseChatModel>();
    model.invoke.mockResolvedValue(new AIMessageChunk("ok"));
    const check = createModelProviderHealthCheck(createRegistry(model), 1_000);

    await expect(check.probe()).resolves.toBe("up");
  });

  it("reports model provider down when route model fails", async () => {
    const model = mockDeep<BaseChatModel>();
    model.invoke.mockRejectedValue(new Error("provider unavailable"));
    const check = createModelProviderHealthCheck(createRegistry(model), 1_000);

    await expect(check.probe()).resolves.toBe("down");
  });
});
