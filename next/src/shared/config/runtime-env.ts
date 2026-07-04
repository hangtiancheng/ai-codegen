import { parseRuntimeEnv, type RuntimeEnv } from "@/shared/schemas";

let cached: RuntimeEnv | null = null;

function getRuntimeEnvSource(): Readonly<Record<string, unknown>> {
  const source: Record<string, unknown> = {};
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const deployDomain = process.env.NEXT_PUBLIC_DEPLOY_DOMAIN;
  if (typeof apiBaseUrl === "string" && apiBaseUrl.length > 0) {
    source.VITE_API_BASE_URL = apiBaseUrl;
  }
  if (typeof deployDomain === "string" && deployDomain.length > 0) {
    source.VITE_DEPLOY_DOMAIN = deployDomain;
  }
  return source;
}

export function getRuntimeEnv(): RuntimeEnv {
  if (cached === null) {
    cached = parseRuntimeEnv(getRuntimeEnvSource());
  }
  return cached;
}

export function resetRuntimeEnvCache(): void {
  cached = null;
}
