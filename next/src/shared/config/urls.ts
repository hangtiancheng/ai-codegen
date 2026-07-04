import { type AppId, type CodegenType, codegenTypeSchema } from "@/shared/schemas";
import { getRuntimeEnv } from "./runtime-env";

export function getApiBaseUrl(): string {
  return getRuntimeEnv().VITE_API_BASE_URL;
}

export function getDeployDomain(): string {
  return getRuntimeEnv().VITE_DEPLOY_DOMAIN;
}

export function getStaticBaseUrl(): string {
  return `${getApiBaseUrl()}/static`;
}

export function getDeployUrl(deployKey: string): string {
  return `${getDeployDomain().replace(/\/$/u, "")}/${deployKey}/index.html`;
}

export function getStaticPreviewUrl(codegenType: CodegenType, appId: AppId): string {
  const validated = codegenTypeSchema.parse(codegenType);
  const base = `${getStaticBaseUrl()}/${validated.toLocaleLowerCase()}_${appId}`;
  return validated === "VITE_PROJECT" ? `${base}/dist/` : `${base}/`;
}
