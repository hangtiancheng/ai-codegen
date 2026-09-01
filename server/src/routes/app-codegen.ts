import { type AppService, appChatCodegenQuerySchema } from "../app-module/index.js";
import type { CodegenService } from "../codegen-agent/index.js";
import { createSseResponse, ErrorCode, HttpError } from "../common/index.js";
import type { MetricsService } from "../observability/index.js";
import type { RateLimiter } from "../rate-limit/index.js";
import type { SessionUser } from "../session/session.schema.js";
import { instrumentCodegenStream } from "./app-codegen-metrics.js";

export type AppCodegenDeps = Readonly<{
  aiGenerationRateLimiter: RateLimiter;
  appService: AppService;
  codegenService: CodegenService;
  metricsService: MetricsService;
}>;

const requireUserId = (user: SessionUser | undefined): bigint => {
  if (user === undefined) {
    throw new HttpError(ErrorCode.NotLoginError, "User not logged in", 401);
  }
  return BigInt(user.id);
};

export const handleAppCodegen = async (
  deps: AppCodegenDeps,
  user: SessionUser | undefined,
  rawQuery: Record<string, string>,
  requestSignal?: AbortSignal,
) => {
  const userId = requireUserId(user);
  const query = appChatCodegenQuerySchema.parse(rawQuery);
  await deps.aiGenerationRateLimiter.consume(userId.toString());
  const app = await deps.appService.requireOwnedApp(query.appId, userId);

  // The agent keeps running (and spending tokens) unless it is told the client
  // is gone. Both the request signal and the response stream's cancel() feed
  // this controller, since either one alone can miss a dropped connection.
  const controller = new AbortController();
  requestSignal?.addEventListener("abort", () => controller.abort());

  return createSseResponse(
    instrumentCodegenStream(
      deps.codegenService.execute({
        abortSignal: controller.signal,
        appId: app.id,
        userId,
        userPrompt: query.message,
      }),
      deps.metricsService,
    ),
    { onCancel: () => controller.abort() },
  );
};
