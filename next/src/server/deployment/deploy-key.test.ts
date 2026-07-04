import { describe, expect, it } from "vitest";
import { generateUniqueDeployKey } from "./deploy-key";

describe("generateUniqueDeployKey", () => {
  it("retries until an unused deploy key is generated", async () => {
    const candidates = ["dup", "free"];
    const key = await generateUniqueDeployKey(
      { exists: async (deployKey) => deployKey === "dup" },
      () => candidates.shift() ?? "fallback",
    );

    expect(key).toBe("free");
  });

  it("fails after bounded attempts when all candidates collide", async () => {
    await expect(
      generateUniqueDeployKey({ exists: async () => true }, () => "dup", 2),
    ).rejects.toThrow("Failed to generate a unique deploy key");
  });
});
