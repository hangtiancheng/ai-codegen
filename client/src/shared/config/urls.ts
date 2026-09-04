import { getRuntimeEnv } from "./runtime-env";

const ABSOLUTE_URL = /^(?:https?|wss?):\/\//iu;

function currentOrigin(): string {
  return globalThis?.location?.origin ?? "http://localhost:3000";
}

export function getApiBaseUrl(): string {
  const configured = getRuntimeEnv().VITE_API_BASE_URL;
  if (ABSOLUTE_URL.test(configured)) return configured;
  return `${currentOrigin()}${configured.startsWith("/") ? configured : `/${configured}`}`;
}
