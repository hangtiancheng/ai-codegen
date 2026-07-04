import { describe, expect, it } from "vitest";
import type { StorageAdapter } from "./storage-adapter";
import {
  createMinioStorageHealthProbe,
  createStorageHealthCheck,
  createStorageWriteHealthProbe,
} from "./storage-health";

describe("storage health", () => {
  it("reports storage write probes as up", async () => {
    const writes: string[] = [];
    const storage: StorageAdapter = {
      putObject: async (input) => {
        writes.push(input.key);
        return "http://cdn/health.txt";
      },
    };
    const check = createStorageHealthCheck(createStorageWriteHealthProbe(storage));

    await expect(check.probe()).resolves.toBe("up");
    expect(writes).toHaveLength(1);
  });

  it("reports MinIO bucket probes as down when the bucket is missing", async () => {
    const probe = createMinioStorageHealthProbe(
      {
        bucketExists: async () => false,
        putObject: async () => undefined,
        statObject: async () => undefined,
      },
      "bucket",
    );
    const check = createStorageHealthCheck(probe);

    await expect(check.probe()).resolves.toBe("down");
  });
});
