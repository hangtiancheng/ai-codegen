import { describe, expect, it } from "vitest";
import { appIdSchema } from "@/shared/schemas";
import { buildChatStreamUrl } from "./chat-stream-url";

describe("buildChatStreamUrl", () => {
  it("uses the configured react stream endpoint", () => {
    const url = buildChatStreamUrl(appIdSchema.parse(10), "build admin app");

    expect(url).toBe(
      "http://localhost:3000/api/app/chat/codegen?appId=10&message=build+admin+app",
    );
  });
});
