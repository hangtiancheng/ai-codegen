import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  envelope,
  requestBodyContains,
  requestedUrlContains,
} from "@/test/http-test-helpers";
import {
  deleteUser,
  getCurrentUser,
  listUserPage,
  login,
  register,
} from "./user-api";

describe("user-api", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it("posts login payloads and parses the login user", async () => {
    fetchSpy.mockResolvedValueOnce(
      envelope({
        code: 0,
        data: { id: "1", userAccount: "admin", userRole: "ADMIN" },
      }),
    );

    const user = await login({
      userAccount: "admin",
      userPassword: "password1",
    });

    expect(user.id).toBe("1");
    expect(user.userRole).toBe("admin");
    expect(requestedUrlContains(fetchSpy.mock.calls, "user/login")).toBe(true);
    expect(requestBodyContains(fetchSpy.mock.calls, "password1")).toBe(true);
  });

  it("validates register payloads before sending", async () => {
    await expect(
      register({
        userAccount: "demo",
        userPassword: "password1",
        checkPassword: "password2",
      }),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses the register id returned as a string", async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ code: 0, data: "2" }));

    await expect(
      register({
        userAccount: "demo",
        userPassword: "password1",
        checkPassword: "password1",
      }),
    ).resolves.toBe("2");
    expect(requestedUrlContains(fetchSpy.mock.calls, "user/register")).toBe(
      true,
    );
  });

  it("sends typed admin list and delete requests", async () => {
    fetchSpy
      .mockResolvedValueOnce(envelope({ code: 0, data: userPage() }))
      .mockResolvedValueOnce(envelope({ code: 0, data: true }));

    const page = await listUserPage({ pageNum: 1, pageSize: 10 });
    const deleted = await deleteUser({ id: page.records[0].id });

    expect(page.records[0].userAccount).toBe("member@example.com");
    expect(deleted).toBe(true);
    expect(requestedUrlContains(fetchSpy.mock.calls, "user/list/page/vo")).toBe(
      true,
    );
    expect(requestedUrlContains(fetchSpy.mock.calls, "user/delete")).toBe(true);
    expect(requestBodyContains(fetchSpy.mock.calls, '"id":"2"')).toBe(true);
  });

  it("parses the current user endpoint", async () => {
    fetchSpy.mockResolvedValueOnce(
      envelope({
        code: 0,
        data: { id: "1", userAccount: "admin", userRole: "ADMIN" },
      }),
    );

    await expect(getCurrentUser()).resolves.toMatchObject({
      userAccount: "admin",
    });
  });
});

function userPage(): unknown {
  return {
    records: [{ id: 2, userAccount: "member@example.com", userRole: "user" }],
    pageNumber: 1,
    pageSize: 10,
    totalPage: 1,
    totalRow: 1,
  };
}
