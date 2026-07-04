import { describe, expect, it } from "vitest";
import { ErrorCode } from "./common/index.js";
import { buildHarness } from "./routes/route-test-harness.js";

const parseBody = async (response: Response) => {
  const raw: unknown = await response.json();
  return raw;
};

describe("app security middleware", () => {
  it("rejects request bodies larger than the configured limit", async () => {
    const { app } = buildHarness();
    const response = await app.request("/api/user/register", {
      body: JSON.stringify({ payload: "x".repeat(1024 * 1024) }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = await parseBody(response);

    expect(response.status).toBe(413);
    expect(body).toEqual({
      code: ErrorCode.ParamsError,
      message: "Request body is too large",
    });
  });

  it("rejects workflow demo prompts beyond the AI prompt limit", async () => {
    const { app } = buildHarness();
    const response = await app.request(`/api/workflow/execute-flux?prompt=${"x".repeat(4097)}`);

    expect(response.status).toBe(400);
  });
});
