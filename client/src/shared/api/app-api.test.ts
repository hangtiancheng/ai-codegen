import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  envelope,
  requestBodyContains,
  requestedUrlContains,
} from "@/test/http-test-helpers";
import { appIdSchema } from "@/shared/schemas";
import {
  addApp,
  deleteAppByAdmin,
  deployApp,
  getAppById,
  listAdminAppPage,
  listAwesomeAppPage,
  listMyAppPage,
  updateAppByAdmin,
} from "./app-api";

describe("app-api", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it("loads app details with a query string", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: appRecord() }));

    const app = await getAppById(appIdSchema.parse(10));

    expect(app.appName).toBe("Admin App");
    expect(requestedUrlContains(fetchSpy.mock.calls, "app/get/vo?id=10")).toBe(
      true,
    );
  });

  it("validates add requests before sending", async () => {
    await expect(addApp({ initPrompt: "" })).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses app ids returned as strings after add", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: "100" }));

    await expect(addApp({ initPrompt: "Build a dashboard" })).resolves.toBe(
      "100",
    );
    expect(requestedUrlContains(fetchSpy.mock.calls, "app/add")).toBe(true);
  });

  it("uses admin list and update endpoints", async () => {
    fetchSpy
      .mockResolvedValueOnce(envelope({ code: 0, data: appPage() }))
      .mockResolvedValueOnce(envelope({ code: 0, data: true }));

    const page = await listAdminAppPage({ pageNum: 1, pageSize: 10 });
    await updateAppByAdmin({ id: page.records[0].id, priority: 99 });

    expect(
      requestedUrlContains(fetchSpy.mock.calls, "app/admin/list/page/vo"),
    ).toBe(true);
    expect(requestedUrlContains(fetchSpy.mock.calls, "app/admin/update")).toBe(
      true,
    );
    expect(requestBodyContains(fetchSpy.mock.calls, '"priority":99')).toBe(
      true,
    );
  });

  it("uses the configured awesome app endpoint", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: appPage() }));

    await listAwesomeAppPage({ pageNum: 1, pageSize: 10 });

    expect(
      requestedUrlContains(fetchSpy.mock.calls, "app/awesome/list/page/vo"),
    ).toBe(true);
  });

  it("normalizes backend records and total app page payloads", async () => {
    fetchSpy.mockResolvedValueOnce(
      envelope({
        code: 0,
        data: {
          records: [],
          total: 0,
        },
      }),
    );

    const page = await listAwesomeAppPage({ pageNum: 1, pageSize: 10 });

    expect(page.records).toEqual([]);
    expect(page.totalRow).toBe(0);
  });

  it("uses my app endpoint with unauthorized redirect suppressed", async () => {
    fetchSpy.mockResolvedValueOnce(
      envelope({ code: 40100, message: "User not logged in" }, 401),
    );

    await expect(listMyAppPage({ pageNum: 1, pageSize: 10 })).rejects.toThrow();
    expect(
      requestedUrlContains(fetchSpy.mock.calls, "app/my/list/page/vo"),
    ).toBe(true);
  });

  it("normalizes legacy app list payload fields", async () => {
    fetchSpy.mockResolvedValueOnce(
      envelope({ code: 0, data: legacyAppPage() }),
    );

    const page = await listAwesomeAppPage({ pageNum: 1, pageSize: 10 });

    expect(page.records[0].appCover).toBe("https://example.com/cover.png");
    expect(page.records[0].codegenType).toBe("VITE_PROJECT");
  });

  it("deletes and deploys apps through validated endpoints", async () => {
    fetchSpy
      .mockResolvedValueOnce(envelope({ code: 0, data: true }))
      .mockResolvedValueOnce(envelope({ code: 0, data: "deploy-key" }));

    const appId = appIdSchema.parse(10);
    await expect(deleteAppByAdmin({ id: appId })).resolves.toBe(true);
    await expect(deployApp({ appId })).resolves.toBe("deploy-key");

    expect(requestedUrlContains(fetchSpy.mock.calls, "app/admin/delete")).toBe(
      true,
    );
    expect(requestedUrlContains(fetchSpy.mock.calls, "app/deploy")).toBe(true);
    expect(requestBodyContains(fetchSpy.mock.calls, '"appId":"10"')).toBe(true);
  });
});

function appRecord(): unknown {
  return {
    id: 10,
    appName: "Admin App",
    initPrompt: "Build an admin app",
    codegenType: "VANILLA_HTML",
    userId: 2,
  };
}

function appPage(): unknown {
  return {
    records: [appRecord()],
    pageNumber: 1,
    pageSize: 10,
    totalPage: 1,
    totalRow: 1,
  };
}

function legacyAppPage(): unknown {
  return {
    records: [
      {
        id: 10,
        appName: "Legacy App",
        appCover: "https://example.com/cover.png",
        initPrompt: "Build a legacy app",
        codegenType: "VITE_PROJECT",
        userId: 2,
      },
    ],
    pageNumber: 1,
    pageSize: 10,
    totalPage: 1,
    totalRow: 1,
  };
}
