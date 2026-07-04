export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function forwardToHono(request: Request): Promise<Response> {
  const { handleHonoRequest } = await import("@/server/next-hono-app");
  return handleHonoRequest(request);
}

export const GET = forwardToHono;
export const POST = forwardToHono;
export const PUT = forwardToHono;
export const PATCH = forwardToHono;
export const DELETE = forwardToHono;
export const HEAD = forwardToHono;
export const OPTIONS = forwardToHono;
