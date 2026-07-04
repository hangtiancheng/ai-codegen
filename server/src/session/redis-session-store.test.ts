import { describe, expect, it } from "vitest";
import { createRedisSessionStore, type RedisSessionClient } from "./redis-session-store.js";
import type { SessionPayload } from "./session.schema.js";

type RedisSetCall = Readonly<{
  key: string;
  mode: "EX";
  seconds: number;
  value: string;
}>;

const createPayload = (expiresAt: number): SessionPayload => ({
  expiresAt,
  user: {
    id: "1",
    userAccount: "tester",
    userAvatar: null,
    username: "Tester",
    userProfile: null,
    userRole: "USER",
  },
});

const createFakeRedis = (initialValues = new Map<string, string>()) => {
  const values = new Map(initialValues);
  const deletedKeys: string[] = [];
  const setCalls: RedisSetCall[] = [];
  const client: RedisSessionClient = {
    del: async (key) => {
      deletedKeys.push(key);
      return values.delete(key) ? 1 : 0;
    },
    get: async (key) => values.get(key) ?? null,
    set: async (key, value, mode, seconds) => {
      setCalls.push({ key, mode, seconds, value });
      values.set(key, value);
      return "OK";
    },
  };
  return { client, deletedKeys, setCalls, values };
};

describe("redis session store", () => {
  it("stores payloads with redis TTL", async () => {
    const redis = createFakeRedis();
    const store = createRedisSessionStore(redis.client, { now: () => 1_000 });
    const payload = createPayload(61_000);

    await store.set("sid", payload);

    expect(redis.setCalls).toEqual([
      {
        key: "session:sid",
        mode: "EX",
        seconds: 60,
        value: JSON.stringify(payload),
      },
    ]);
    await expect(store.get("sid")).resolves.toEqual(payload);
  });

  it("deletes explicit sessions", async () => {
    const redis = createFakeRedis(new Map([["session:sid", "{}"]]));
    const store = createRedisSessionStore(redis.client);

    await store.delete("sid");

    expect(redis.deletedKeys).toEqual(["session:sid"]);
    expect(redis.values.has("session:sid")).toBe(false);
  });

  it("deletes expired payloads on read", async () => {
    const payload = createPayload(999);
    const redis = createFakeRedis(new Map([["session:sid", JSON.stringify(payload)]]));
    const store = createRedisSessionStore(redis.client, { now: () => 1_000 });

    await expect(store.get("sid")).resolves.toBeUndefined();

    expect(redis.deletedKeys).toEqual(["session:sid"]);
  });

  it("deletes invalid JSON payloads", async () => {
    const redis = createFakeRedis(new Map([["session:sid", "{"]]));
    const store = createRedisSessionStore(redis.client);

    await expect(store.get("sid")).resolves.toBeUndefined();

    expect(redis.deletedKeys).toEqual(["session:sid"]);
  });

  it("deletes schema-invalid payloads", async () => {
    const redis = createFakeRedis(
      new Map([["session:sid", JSON.stringify({ expiresAt: 10_000, user: null })]]),
    );
    const store = createRedisSessionStore(redis.client);

    await expect(store.get("sid")).resolves.toBeUndefined();

    expect(redis.deletedKeys).toEqual(["session:sid"]);
  });

  it("does not store already expired payloads", async () => {
    const redis = createFakeRedis();
    const store = createRedisSessionStore(redis.client, { now: () => 2_000 });

    await store.set("sid", createPayload(1_000));

    expect(redis.setCalls).toEqual([]);
    expect(redis.deletedKeys).toEqual(["session:sid"]);
  });
});
