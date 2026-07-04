import { describe, expect, it, vi } from "vitest";
import { ApiException } from "./api-error";
import { type ChatStreamHandlers, runChatStream, type StreamEngine } from "./chat-stream-client";

function makeHandlers(): {
  handlers: ChatStreamHandlers;
  chunks: string[];
  onDone: ReturnType<typeof vi.fn>;
  onError: ReturnType<typeof vi.fn<(error: ApiException) => void>>;
} {
  const chunks: string[] = [];
  const onDone = vi.fn();
  const onError = vi.fn<(error: ApiException) => void>();
  return {
    handlers: {
      onChunk: (chunk) => {
        chunks.push(chunk);
      },
      onDone,
      onError,
    },
    chunks,
    onDone,
    onError,
  };
}

describe("runChatStream", () => {
  it("dispatches message chunks and calls onDone for done event", async () => {
    const engine: StreamEngine = async (_url, init) => {
      init.onmessage({ event: "", data: JSON.stringify({ d: "a" }) });
      init.onmessage({ event: "", data: JSON.stringify({ d: "b" }) });
      init.onmessage({ event: "done", data: "" });
    };
    const { handlers, chunks, onDone, onError } = makeHandlers();
    await runChatStream({ url: "/x" }, handlers, engine);
    expect(chunks).toEqual(["a", "b"]);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onDone via onclose when no done event arrives", async () => {
    const engine: StreamEngine = async (_url, init) => {
      init.onmessage({ event: "", data: JSON.stringify({ d: "x" }) });
      init.onclose();
    };
    const { handlers, onDone } = makeHandlers();
    await runChatStream({ url: "/x" }, handlers, engine);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("dispatches business-error event as ApiException with business kind", async () => {
    const engine: StreamEngine = async (_url, init) => {
      init.onmessage({
        event: "business-error",
        data: JSON.stringify({ code: 7, message: "nope" }),
      });
    };
    const { handlers, onDone, onError } = makeHandlers();
    await runChatStream({ url: "/x" }, handlers, engine);
    expect(onError).toHaveBeenCalledTimes(1);
    const call = onError.mock.calls[0];
    expect(call).toBeDefined();
    const [argument] = call ?? [];
    expect(argument).toBeInstanceOf(ApiException);
    expect(argument?.error).toEqual({
      kind: "business",
      code: 7,
      message: "nope",
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it("ignores chunks after a terminal event", async () => {
    const engine: StreamEngine = async (_url, init) => {
      init.onmessage({ event: "done", data: "" });
      init.onmessage({ event: "", data: JSON.stringify({ d: "after" }) });
    };
    const { handlers, chunks, onDone } = makeHandlers();
    await runChatStream({ url: "/x" }, handlers, engine);
    expect(chunks).toEqual([]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("maps AbortError to aborted ApiException", async () => {
    const engine: StreamEngine = async (_url, init) => {
      init.onerror(new DOMException("abort", "AbortError"));
    };
    const { handlers, onError } = makeHandlers();
    await runChatStream({ url: "/x" }, handlers, engine);
    const argument = onError.mock.calls[0]?.[0];
    expect(argument?.error).toEqual({
      kind: "aborted",
      message: "stream aborted",
    });
  });

  it("maps generic engine error to network ApiException", async () => {
    const engine: StreamEngine = async (_url, init) => {
      init.onerror(new TypeError("offline"));
    };
    const { handlers, onError } = makeHandlers();
    await runChatStream({ url: "/x" }, handlers, engine);
    const argument = onError.mock.calls[0]?.[0];
    expect(argument?.error.kind).toBe("network");
  });

  it("ignores malformed message events without crashing", async () => {
    const engine: StreamEngine = async (_url, init) => {
      init.onmessage({ event: "", data: "{not-json" });
      init.onmessage({ event: "done", data: "" });
    };
    const { handlers, chunks, onDone } = makeHandlers();
    await runChatStream({ url: "/x" }, handlers, engine);
    expect(chunks).toEqual([]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
