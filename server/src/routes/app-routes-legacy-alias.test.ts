import { describe, expect, it } from "vitest";
import { ErrorCode } from "../common/index.js";
import { buildApp } from "../test-support/index.js";
import { buildHarness, jsonRequest, parseBody } from "./user-routes-utils.js";

describe("app routes - legacy aliases", () => {
  it("/awesome/list/page/vo preserves the featured app route", async () => {
    const { app, db } = buildHarness();
    db.app.findMany.mockResolvedValueOnce([buildApp({ id: 1n, priority: 99 })]);
    db.app.count.mockResolvedValueOnce(1);

    const response = await jsonRequest(app, "/api/app/awesome/list/page/vo", {
      current: 1,
      pageSize: 5,
    });
    const body = await parseBody(response);

    expect(response.status).toBe(200);
    expect(body.code).toBe(ErrorCode.Success);
    expect(db.app.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isDelete: false, priority: 99 }),
      }),
    );
  });
});
