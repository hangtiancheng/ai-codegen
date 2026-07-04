import { describe, expect, it } from "vitest";
import { z } from "zod";
import { pageSchema, paginationQuerySchema } from "./pagination";

describe("pageSchema", () => {
  const schema = pageSchema(z.object({ id: z.number() }));

  it("parses a valid page", () => {
    const value = schema.parse({
      records: [{ id: 1 }, { id: 2 }],
      pageNumber: 1,
      pageSize: 10,
      totalPage: 1,
      totalRow: 2,
    });
    expect(value.records).toHaveLength(2);
  });

  it("normalizes backend records and total payloads", () => {
    const value = schema.parse({
      records: [],
      total: 0,
    });

    expect(value.pageNumber).toBe(1);
    expect(value.pageSize).toBe(1);
    expect(value.totalPage).toBe(0);
    expect(value.totalRow).toBe(0);
  });

  it("rejects negative pageNumber", () => {
    const result = schema.safeParse({
      records: [],
      pageNumber: 0,
      pageSize: 10,
      totalPage: 0,
      totalRow: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("paginationQuerySchema", () => {
  it("applies defaults", () => {
    const value = paginationQuerySchema.parse({});
    expect(value.pageNum).toBe(1);
    expect(value.pageSize).toBe(10);
  });

  it("rejects unknown sort order", () => {
    const result = paginationQuerySchema.safeParse({ sortOrder: "weird" });
    expect(result.success).toBe(false);
  });
});
