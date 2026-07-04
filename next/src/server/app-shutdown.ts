type CloseResource = Readonly<{
  close: () => Promise<void>;
}>;

type OptionalCloseResource = Readonly<{
  close?: () => Promise<void>;
}>;

type RedisShutdownClient = Readonly<{
  quit: () => Promise<unknown>;
}>;

type DatabaseShutdownClient = Readonly<{
  $disconnect: () => Promise<void>;
}>;

export type DefaultShutdownInput = Readonly<{
  database: DatabaseShutdownClient;
  redisClient?: RedisShutdownClient;
  screenshotQueue?: OptionalCloseResource;
  screenshotQueueEvents?: CloseResource;
  screenshotWorker?: CloseResource;
}>;

export const createDefaultShutdown =
  (input: DefaultShutdownInput): (() => Promise<void>) =>
  async () => {
    if (input.screenshotQueueEvents !== undefined) {
      await input.screenshotQueueEvents.close();
    }
    if (input.screenshotWorker !== undefined) {
      await input.screenshotWorker.close();
    }
    if (input.screenshotQueue?.close !== undefined) {
      await input.screenshotQueue.close();
    }
    if (input.redisClient !== undefined) {
      await input.redisClient.quit();
    }
    await input.database.$disconnect();
  };
