import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseStorageObjectKey } from "./storage-object-key";

export type StoragePutInput = Readonly<{
  contentType: string;
  key: string;
  value: Buffer;
}>;

export type StorageAdapter = Readonly<{
  putObject: (input: StoragePutInput) => Promise<string>;
}>;

export const createLocalStorageAdapter = (
  rootDir: string,
  publicBaseUrl: string,
): StorageAdapter => ({
  putObject: async (input) => {
    const key = parseStorageObjectKey(input.key);
    const filePath = join(rootDir, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, input.value);
    return `${publicBaseUrl.replace(/\/$/u, "")}/${key}`;
  },
});

export const createMinioCompatibleStorageAdapter = (
  endpoint: string,
  bucket: string,
  publicBaseUrl: string,
  fetcher: typeof fetch = fetch,
): StorageAdapter => ({
  putObject: async (input) => {
    const key = parseStorageObjectKey(input.key);
    const url = `${endpoint.replace(/\/$/u, "")}/${bucket}/${key}`;
    const response = await fetcher(url, {
      body: new Uint8Array(input.value),
      headers: { "Content-Type": input.contentType },
      method: "PUT",
    });
    if (!response.ok) {
      throw new Error(`Object storage upload failed with status ${response.status}`);
    }
    return `${publicBaseUrl.replace(/\/$/u, "")}/${key}`;
  },
});
