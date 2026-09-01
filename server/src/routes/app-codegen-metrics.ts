import type { CodegenSseEvent } from "../codegen-agent/index.js";
import type { MetricsService } from "../observability/index.js";

const MODEL_ROLE = "agent";

export const instrumentCodegenStream = async function* (
  events: AsyncIterable<CodegenSseEvent>,
  metricsService: MetricsService,
): AsyncGenerator<CodegenSseEvent> {
  const startedAt = Date.now();
  let status: "success" | "error" = "success";
  try {
    for await (const event of events) {
      if (event.event === "business-error") {
        status = "error";
        metricsService.recordAiError({
          errorType: "business-error",
          modelRole: MODEL_ROLE,
        });
      }
      yield event;
    }
  } catch (error) {
    status = "error";
    metricsService.recordAiError({
      errorType: error instanceof Error ? error.name : "unknown",
      modelRole: MODEL_ROLE,
    });
    throw error;
  } finally {
    metricsService.recordAiRequest({ modelRole: MODEL_ROLE, status });
    metricsService.recordAiResponseTime({
      durationMs: Date.now() - startedAt,
      modelRole: MODEL_ROLE,
    });
  }
};
