import { describe, expect, it } from "vitest";
import { mapAppQueryRequest } from "./app-query-request";

describe("mapAppQueryRequest", () => {
  it("keeps the canonical codegenType request field", () => {
    const body = mapAppQueryRequest({
      pageNum: 1,
      pageSize: 10,
      codegenType: "VITE_PROJECT",
    });

    expect(body).toEqual({
      pageNum: 1,
      pageSize: 10,
      codegenType: "VITE_PROJECT",
    });
  });
});
