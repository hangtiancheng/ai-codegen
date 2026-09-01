import type { FileSystemTree } from "@webcontainer/api";
import type { AppId } from "@/shared/schemas";
import {
  appFileTreeTransportSchema,
  toWebContainerFileTree,
} from "@/shared/webcontainer";
import { httpClient } from "./http-client-singleton";

export async function fetchAppFileTree(appId: AppId): Promise<FileSystemTree> {
  const transport = await httpClient.request(
    { method: "GET", url: `app/files/${appId}` },
    appFileTreeTransportSchema,
  );
  return toWebContainerFileTree(transport);
}
