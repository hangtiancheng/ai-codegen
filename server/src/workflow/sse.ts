import type { WorkflowSseEvent } from "./workflow-events.schema.js";

const encoder = new TextEncoder();

export const formatSseEvent = (event: WorkflowSseEvent): string =>
  `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;

export const createWorkflowSseResponse = (events: AsyncIterable<WorkflowSseEvent>): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        for await (const event of events) {
          controller.enqueue(encoder.encode(formatSseEvent(event)));
        }
        controller.close();
      },
    }),
    {
      headers: {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    },
  );
