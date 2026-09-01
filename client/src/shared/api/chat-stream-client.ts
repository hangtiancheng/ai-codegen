import { fetchEventSource } from "@microsoft/fetch-event-source";
import { type ChatStreamToolPayload } from "@/shared/schemas";
import { ApiException } from "./api-error";
import { parseStreamEvent, type ParsedStreamEvent } from "./chat-stream-parser";

export type ChatStreamHandlers = {
  readonly onChunk: (chunk: string) => void;
  readonly onTool: (payload: ChatStreamToolPayload) => void;
  readonly onDone: () => void;
  readonly onError: (error: ApiException) => void;
};

export type ChatStreamRequest = {
  readonly url: string;
  readonly signal?: AbortSignal;
};

export type StreamEngine = (
  url: string,
  init: {
    readonly signal?: AbortSignal;
    readonly onmessage: (raw: { event: string; data: string }) => void;
    readonly onclose: () => void;
    readonly onerror: (cause: unknown) => void;
  },
) => Promise<void>;

const defaultEngine: StreamEngine = async (url, init) => {
  await fetchEventSource(url, {
    method: "GET",
    credentials: "include",
    openWhenHidden: true,
    ...(init.signal ? { signal: init.signal } : {}),
    onmessage: (event) =>
      init.onmessage({ event: event.event, data: event.data }),
    onclose: () => init.onclose(),
    onerror: (cause) => {
      init.onerror(cause);
      throw cause;
    },
  });
};

function dispatch(
  parsed: ParsedStreamEvent,
  handlers: ChatStreamHandlers,
  state: { closed: boolean },
): void {
  if (state.closed) return;
  switch (parsed.kind) {
    case "message":
      handlers.onChunk(parsed.payload.d);
      break;
    case "tool":
      handlers.onTool(parsed.payload);
      break;
    case "done":
      state.closed = true;
      handlers.onDone();
      break;
    case "business-error":
      state.closed = true;
      handlers.onError(
        new ApiException({
          kind: "business",
          code: parsed.payload.code ?? -1,
          message: parsed.payload.message,
        }),
      );
      break;
    case "ignored":
      break;
  }
}

export async function runChatStream(
  request: ChatStreamRequest,
  handlers: ChatStreamHandlers,
  engine: StreamEngine = defaultEngine,
): Promise<void> {
  const state = { closed: false };
  try {
    await engine(request.url, {
      ...(request.signal ? { signal: request.signal } : {}),
      onmessage: (raw) => dispatch(parseStreamEvent(raw), handlers, state),
      onclose: () => {
        if (!state.closed) {
          state.closed = true;
          handlers.onDone();
        }
      },
      onerror: (cause) => {
        if (state.closed) return;
        state.closed = true;
        if (cause instanceof DOMException && cause.name === "AbortError") {
          handlers.onError(
            new ApiException({ kind: "aborted", message: "stream aborted" }),
          );
          return;
        }
        handlers.onError(
          new ApiException({
            kind: "network",
            message: cause instanceof Error ? cause.message : "stream failed",
            cause,
          }),
        );
      },
    });
  } catch {
    // engine errors already surface through onerror
  }
}
