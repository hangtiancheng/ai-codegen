import { describe, expect, it } from "vitest";
import { appIdSchema } from "@/shared/schemas";
import { resolveEndpointPaths } from "./endpoints";

describe("resolveEndpointPaths", () => {
  it("returns the canonical endpoint paths", () => {
    const endpoints = resolveEndpointPaths();

    expect(endpoints.awesomeAppList).toBe("app/awesome/list/page/vo");
    expect(endpoints.appChatHistory(appIdSchema.parse(10))).toBe(
      "chat-history/app/10",
    );
    expect(endpoints.adminChatHistoryList).toBe(
      "chat-history/admin/list/page/vo",
    );
    expect(endpoints.chatStream).toBe("app/chat/codegen");
  });
});
