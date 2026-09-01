const encoder = new TextEncoder();

export type SseEvent = Readonly<{ data: unknown; event: string }>;

export const formatSseEvent = (event: SseEvent): string =>
  `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;

export const createSseResponse = <E extends SseEvent>(
  events: AsyncIterable<E>,
  options: Readonly<{ onCancel?: () => void }> = {},
): Response => {
  const iterator = events[Symbol.asyncIterator]();
  return new Response(
    // Pull-based so the producer stops as soon as the client stops reading,
    // and so cancel() can propagate an abort into the running generator.
    new ReadableStream<Uint8Array>({
      async cancel() {
        options.onCancel?.();
        await iterator.return?.();
      },
      async pull(controller) {
        const next = await iterator.next();
        if (next.done === true) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(formatSseEvent(next.value)));
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
};
