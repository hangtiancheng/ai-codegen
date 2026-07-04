import { getApiBaseUrl, getEndpointPaths } from "@/shared/config";
import { type AppId } from "@/shared/schemas";
import { buildUrl } from "@/shared/api";

export function buildChatStreamUrl(appId: AppId, message: string): string {
  return buildUrl(getApiBaseUrl(), {
    method: "GET",
    url: getEndpointPaths().chatStream,
    query: {
      appId,
      message,
    },
  });
}
