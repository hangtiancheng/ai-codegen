import { createReadStream } from "node:fs";
import type { Context } from "hono";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { ErrorCode, HttpError } from "../common/index.js";
import { resolveInsideBase, resolveStaticFile } from "../project/index.js";
import type { AppHonoEnv } from "../session/index.js";

export type StaticRoutesDeps = Readonly<{
  outputRootDir: string;
}>;

const staticResponse = (c: Context<AppHonoEnv>, resolved: ReturnType<typeof resolveStaticFile>) => {
  c.header("Cache-Control", "public, max-age=86400");
  c.header("Content-Type", resolved.contentType);
  return stream(c, async (responseStream) => {
    const fileStream = createReadStream(resolved.filePath);
    for await (const chunk of fileStream) {
      await responseStream.write(chunk);
    }
  });
};

const splitStaticPath = (value: string) => {
  const [outputKey = "", ...rest] = value.split("/");
  const nestedPath = rest.join("/");
  return {
    hasExplicitRelativePath: rest.length > 0 && nestedPath.length > 0,
    outputKey,
    relativePath: nestedPath.length === 0 ? "index.html" : nestedPath,
  };
};

const outputKeyPrefixMap: Readonly<Record<string, string>> = {
  html: "VANILLA_HTML",
  MULTI_FILES: "MULTI_FILES",
};

const normalizeOutputKey = (outputKey: string): string => {
  const separatorIndex = outputKey.lastIndexOf("_");
  if (separatorIndex < 0) return outputKey;
  const prefix = outputKey.slice(0, separatorIndex);
  const appId = outputKey.slice(separatorIndex + 1);
  const backendPrefix = outputKeyPrefixMap[prefix];
  return backendPrefix === undefined ? outputKey : `${backendPrefix}_${appId}`;
};

const backendOutputKeyPrefixes = new Set(Object.values(outputKeyPrefixMap));

const isPreviewOutputKey = (outputKey: string): boolean => {
  const separatorIndex = outputKey.lastIndexOf("_");
  if (separatorIndex < 0) return false;
  const prefix = outputKey.slice(0, separatorIndex);
  const appId = outputKey.slice(separatorIndex + 1);
  return (
    /^[1-9][0-9]*$/u.test(appId) &&
    (outputKeyPrefixMap[prefix] !== undefined || backendOutputKeyPrefixes.has(prefix))
  );
};

const shouldRedirectPreviewRoot = (
  url: string,
  outputKey: string,
  hasExplicitRelativePath: boolean,
): boolean => {
  const pathname = new URL(url).pathname;
  return !hasExplicitRelativePath && !pathname.endsWith("/") && isPreviewOutputKey(outputKey);
};

const previewRootRedirectUrl = (url: string): string => {
  const parsed = new URL(url);
  parsed.pathname = `${parsed.pathname}/`;
  return `${parsed.pathname}${parsed.search}`;
};

const pathAfterMarker = (url: string, marker: string): string => {
  const path = new URL(url).pathname;
  const index = path.indexOf(marker);
  if (index < 0) {
    throw new HttpError(ErrorCode.NotFoundError, "Static route not found", 404);
  }
  try {
    return decodeURIComponent(path.slice(index + marker.length));
  } catch {
    throw new HttpError(ErrorCode.ParamsError, "Invalid static path", 400);
  }
};

const staticPathFromUrl = (url: string): string => pathAfterMarker(url, "/static/");

export const createStaticRoutes = ({ outputRootDir }: StaticRoutesDeps) =>
  new Hono<AppHonoEnv>().get("/static/*", (c) => {
    const { hasExplicitRelativePath, outputKey, relativePath } = splitStaticPath(
      staticPathFromUrl(c.req.url),
    );
    if (shouldRedirectPreviewRoot(c.req.url, outputKey, hasExplicitRelativePath)) {
      return c.redirect(previewRootRedirectUrl(c.req.url), 308);
    }
    const outputDir = resolveInsideBase(outputRootDir, normalizeOutputKey(outputKey));
    const resolved = resolveStaticFile(outputDir, relativePath);
    return staticResponse(c, resolved);
  });

export type StaticRoutes = ReturnType<typeof createStaticRoutes>;
