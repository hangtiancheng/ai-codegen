export function envelope(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function requestBodyContains(
  calls: ReadonlyArray<ReadonlyArray<unknown>>,
  expected: string,
): boolean {
  return calls.some((call) => {
    const init = call[1];
    return isRequestInit(init) && init.body?.toString().includes(expected);
  });
}

export function requestedUrlContains(
  calls: ReadonlyArray<ReadonlyArray<unknown>>,
  expected: string,
): boolean {
  return calls.some((call) => {
    const url = call[0];
    return typeof url === "string" && url.includes(expected);
  });
}

function isRequestInit(value: unknown): value is RequestInit {
  return typeof value === "object" && value !== null && "body" in value;
}
