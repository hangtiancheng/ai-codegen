import { type AppService, appChatCodegenQuerySchema } from "../app-module/index.js";
import { ErrorCode, HttpError } from "../common/index.js";
import type { MetricsService } from "../observability/index.js";
import type { RateLimiter } from "../rate-limit/index.js";
import type { SessionUser } from "../session/session.schema.js";
import { type CodegenWorkflow, createWorkflowSseResponse } from "../workflow/index.js";
import { instrumentWorkflow } from "./app-codegen-metrics.js";

export type AppCodegenDeps = Readonly<{
  aiGenerationRateLimiter: RateLimiter;
  appService: AppService;
  codegenWorkflow: CodegenWorkflow;
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
) => {
  const userId = requireUserId(user);
  const query = appChatCodegenQuerySchema.parse(rawQuery);
  await deps.aiGenerationRateLimiter.consume(userId.toString());
  deps.metricsService.recordAiTokenUsage({
    modelRole: "streaming",
    tokenType: "input",
    tokens: query.message.length,
  });
  const app = await deps.appService.requireOwnedApp(query.appId, userId);
  return createWorkflowSseResponse(
    instrumentWorkflow(
      deps.codegenWorkflow.execute({
        appId: query.appId,
        codegenType: app.codegenType,
        userId,
        userPrompt: query.message,
      }),
      deps.metricsService,
    ),
  );
};
