import {
  chatStreamBusinessErrorPayloadSchema,
  chatStreamEventNames,
  chatStreamMessagePayloadSchema,
  type ChatStreamBusinessErrorPayload,
  type ChatStreamMessagePayload,
} from "@/shared/schemas";

export type ParsedStreamEvent =
  | { kind: "message"; payload: ChatStreamMessagePayload }
  | { kind: "done" }
  | { kind: "business-error"; payload: ChatStreamBusinessErrorPayload }
  | { kind: "ignored" };

export type RawStreamEvent = {
  readonly event: string;
  readonly data: string;
};

function parseJsonSafely(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function parseStreamEvent(raw: RawStreamEvent): ParsedStreamEvent {
  const eventName = raw.event === "" ? chatStreamEventNames.message : raw.event;
  if (eventName === chatStreamEventNames.done) {
    return { kind: "done" };
  }
  if (eventName === chatStreamEventNames.businessError) {
    const parsed = chatStreamBusinessErrorPayloadSchema.safeParse(
      parseJsonSafely(raw.data),
    );
    if (parsed.success) {
      return { kind: "business-error", payload: parsed.data };
    }
    return {
      kind: "business-error",
      payload: { message: "Stream error" },
    };
  }
  if (eventName === chatStreamEventNames.message) {
    const parsed = chatStreamMessagePayloadSchema.safeParse(
      parseJsonSafely(raw.data),
    );
    if (parsed.success) {
      return { kind: "message", payload: parsed.data };
    }
  }
  return { kind: "ignored" };
}
