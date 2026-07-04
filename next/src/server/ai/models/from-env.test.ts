import { describe, expect, it } from "vitest";
import { aiEnvSchema } from "../../config/ai-env.schema";
import { buildAiModelRegistryConfigFromEnv } from "./from-env";

describe("AI model registry config from env", () => {
  it("builds four Ollama-backed model roles from defaults", () => {
    const env = aiEnvSchema.parse({});
    const config = buildAiModelRegistryConfigFromEnv(env);

    expect(config.route).toMatchObject({
      maxTokens: 100,
      modelName: "qwen2.5",
      provider: {
        baseUrl: "http://localhost:11434",
        kind: "ollama",
      },
      streaming: false,
      temperature: 0,
    });
    expect(config.streaming.streaming).toBe(true);
    expect(config.reasoning.streaming).toBe(true);
    expect(config.quality.streaming).toBe(false);
  });
});
