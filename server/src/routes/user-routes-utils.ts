import { z } from "zod";
import type { AppType } from "../app.js";
import { hashPassword } from "../common/index.js";
import { UserRole } from "../generated/prisma/enums.js";
import type { UserModel } from "../generated/prisma/models/User.js";
import { buildUser } from "../test-support/index.js";
import type { CodegenWorkflow, WorkflowSseEvent } from "../workflow/index.js";

export type { RouteTestHarness } from "./route-test-harness.js";
export { buildHarness } from "./route-test-harness.js";

export const createStaticWorkflow = (events: readonly string[]): CodegenWorkflow => ({
  execute: async function* () {
    for (const event of events) {
      const chunk: WorkflowSseEvent = { data: { d: event }, event: "chunk" };
      yield chunk;
    }
    const done: WorkflowSseEvent = { data: {}, event: "done" };
    yield done;
  },
});

export const buildAdmin = (overrides: Partial<UserModel> = {}): UserModel =>
  buildUser({
    userPassword: hashPassword("password123"),
    userRole: UserRole.ADMIN,
    ...overrides,
  });

export const buildRegularUser = (overrides: Partial<UserModel> = {}): UserModel =>
  buildUser({
    userPassword: hashPassword("password123"),
    userRole: UserRole.USER,
    ...overrides,
  });

export const responseBodySchema = z.object({
  code: z.number(),
  data: z.unknown().optional(),
  message: z.string(),
});

export const parseBody = async (response: Response) => {
  const raw: unknown = await response.json();
  return responseBodySchema.parse(raw);
};

export const loginAndGetCookie = async (
  app: AppType,
  userAccount: string,
  userPassword: string,
): Promise<string> => {
  const response = await app.request("/api/user/login", {
    body: JSON.stringify({ userAccount, userPassword }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie === null) {
    throw new Error("login did not set a cookie");
  }
  const [pair] = setCookie.split(";");
  if (pair === undefined) {
    throw new Error("malformed set-cookie header");
  }
  return pair;
};

export const jsonRequest = async (
  app: AppType,
  path: string,
  body: unknown,
  cookie?: string,
): Promise<Response> =>
  app.request(path, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(cookie !== undefined && { Cookie: cookie }),
    },
    method: "POST",
  });
