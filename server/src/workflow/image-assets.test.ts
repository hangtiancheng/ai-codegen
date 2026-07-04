import { describe, expect, it } from "vitest";
import { imageCollectionPlanSchema, imageResourceListSchema } from "./image-assets.schema.js";
import { appendImageResourcesToPrompt } from "./image-prompt.js";

describe("image workflow contracts", () => {
  it("parses image collection plans with default task arrays", () => {
    const plan = imageCollectionPlanSchema.parse({
      contentImageTasks: [{ query: "landing page hero" }],
      diagramTasks: [
        {
          description: "System architecture",
          mermaidCode: "graph TD; A-->B;",
        },
      ],
    });

    expect(plan.contentImageTasks).toHaveLength(1);
    expect(plan.illustrationTasks).toEqual([]);
    expect(plan.logoTasks).toEqual([]);
  });

  it("rejects invalid image tool output before prompt usage", () => {
    expect(() =>
      imageResourceListSchema.parse([
        {
          category: "CONTENT",
          description: "Hero",
          url: "not-a-url",
        },
      ]),
    ).toThrow();
  });

  it("appends validated image resources without changing existing SSE contracts", () => {
    const prompt = appendImageResourcesToPrompt("Build a product site", [
      {
        category: "LOGO",
        description: "Minimal brand mark",
        url: "https://cdn.example.com/logo.png",
      },
    ]);

    expect(prompt).toContain("## Available Visual Assets");
    expect(prompt).toContain("Logo: Minimal brand mark");
    expect(prompt).toContain("https://cdn.example.com/logo.png");
  });
});
