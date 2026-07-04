import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createMinioSdkStorageAdapter,
  type MinioStorageClient,
} from "./minio-storage-adapter.js";
import {
  createLocalStorageAdapter,
  createMinioCompatibleStorageAdapter,
} from "./storage-adapter.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("storage adapters", () => {
  it("writes local objects and returns a public URL", async () => {
    const root = await mkdtemp(join(tmpdir(), "swifty-codegen-storage-"));
    tempDirs.push(root);
    const adapter = createLocalStorageAdapter(
      root,
      "http://localhost:3000/storage/",
    );

    const url = await adapter.putObject({
      contentType: "image/png",
      key: "screenshots/a.png",
      value: Buffer.from("png"),
    });

    expect(url).toBe("http://localhost:3000/storage/screenshots/a.png");
    await expect(
      readFile(join(root, "screenshots", "a.png"), "utf-8"),
    ).resolves.toBe("png");
  });

  it("uploads to a MinIO-compatible endpoint with PUT", async () => {
    const calls: string[] = [];
    const adapter = createMinioCompatibleStorageAdapter(
      "http://minio:9000",
      "bucket",
      "http://cdn",
      async (input, init) => {
        calls.push(`${String(input)} ${init?.method ?? ""}`);
        return new Response("", { status: 200 });
      },
    );

    const url = await adapter.putObject({
      contentType: "image/png",
      key: "screenshots/a.png",
      value: Buffer.from("png"),
    });

    expect(url).toBe("http://cdn/screenshots/a.png");
    expect(calls).toEqual(["http://minio:9000/bucket/screenshots/a.png PUT"]);
  });

  it("rejects unsafe object keys", async () => {
    const root = await mkdtemp(join(tmpdir(), "swifty-codegen-storage-"));
    tempDirs.push(root);
    const adapter = createLocalStorageAdapter(
      root,
      "http://localhost:3000/storage",
    );

    await expect(
      adapter.putObject({
        contentType: "text/plain",
        key: "../escape.txt",
        value: Buffer.from("x"),
      }),
    ).rejects.toThrow();
  });

  it("uploads through authenticated MinIO SDK clients", async () => {
    const calls: string[] = [];
    const client: MinioStorageClient = {
      bucketExists: async () => true,
      putObject: async (bucketName, objectName, value, size, metaData) => {
        calls.push(
          `${bucketName}/${objectName}/${value.toString("utf-8")}/${String(size)}/${metaData["Content-Type"]}`,
        );
      },
      statObject: async () => ({ etag: "etag" }),
    };
    const adapter = createMinioSdkStorageAdapter(
      client,
      "bucket",
      "http://cdn/",
    );

    const url = await adapter.putObject({
      contentType: "image/png",
      key: "screenshots/a.png",
      value: Buffer.from("png"),
    });

    expect(url).toBe("http://cdn/screenshots/a.png");
    expect(calls).toEqual(["bucket/screenshots/a.png/png/3/image/png"]);
  });
});
