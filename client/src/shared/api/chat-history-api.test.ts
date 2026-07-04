import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  envelope,
  requestBodyContains,
  requestedUrlContains,
} from "@/test/http-test-helpers";
import { appIdSchema } from "@/shared/schemas";
import {
  listAdminChatHistoryPage,
  listAppChatHistory,
} from "./chat-history-api";

describe("chat-history-api", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it("loads app chat history through cursor query params", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: chatRecords() }));

    const page = await listAppChatHistory(appIdSchema.parse(10), {
      pageSize: 20,
      lastCreateTime: "2026-05-18T10:00:00Z",
    });

    expect(page.records[0].message).toBe("Generate dashboard");
    expect(page.records[0].messageType).toBe("ai");
    expect(page.totalRow).toBe(1);
    expect(
      requestedUrlContains(fetchSpy.mock.calls, "chat-history/app/10"),
    ).toBe(true);
    expect(requestedUrlContains(fetchSpy.mock.calls, "pageSize=20")).toBe(true);
    expect(
      requestedUrlContains(fetchSpy.mock.calls, "cursor=2026-05-18T10"),
    ).toBe(true);
  });

  it("validates admin chat filters and parses page responses", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: chatPage() }));

    const page = await listAdminChatHistoryPage({
      appId: appIdSchema.parse(10n),
      pageNum: 1,
      pageSize: 10,
      messageType: "user",
    });

    expect(page.totalRow).toBe(1);
    expect(
      requestedUrlContains(fetchSpy.mock.calls, "admin/list/page/vo"),
    ).toBe(true);
    expect(
      requestBodyContains(fetchSpy.mock.calls, '"messageType":"user"'),
    ).toBe(true);
    expect(requestBodyContains(fetchSpy.mock.calls, '"appId":"10"')).toBe(true);
  });
});

function chatPage(): unknown {
  return {
    records: chatRecords(),
    pageNumber: 1,
    pageSize: 10,
    totalPage: 1,
    totalRow: 1,
  };
}

function chatRecords(): unknown {
  return [
    {
      id: "20",
      appId: "10",
      userId: "2",
      message: "Generate dashboard",
      messageType: "AI",
      createTime: "2026-05-18T10:00:00Z",
    },
  ];
}
