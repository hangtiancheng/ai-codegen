import { getRuntimeEnv } from "./runtime-env";

export function getApiBaseUrl(): string {
  return getRuntimeEnv().VITE_API_BASE_URL;
}
