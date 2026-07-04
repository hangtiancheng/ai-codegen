import type { MetricsService } from "../observability/index";
import type { WorkflowSseEvent } from "../workflow/index";

export const instrumentWorkflow = async function* (
  workflowEvents: AsyncIterable<WorkflowSseEvent>,
  metricsService: MetricsService,
): AsyncGenerator<WorkflowSseEvent> {
  const startedAt = Date.now();
  let status: "success" | "error" = "success";
  try {
    for await (const event of workflowEvents) {
      if (event.event === "business-error") {
        status = "error";
        metricsService.recordAiError({
          errorType: "business-error",
          modelRole: "streaming",
        });
      }
      yield event;
    }
  } catch (error) {
    status = "error";
    metricsService.recordAiError({
      errorType: error instanceof Error ? error.name : "unknown",
      modelRole: "streaming",
    });
    throw error;
  } finally {
    metricsService.recordAiRequest({ modelRole: "streaming", status });
    metricsService.recordAiResponseTime({
      durationMs: Date.now() - startedAt,
      modelRole: "streaming",
    });
  }
};
