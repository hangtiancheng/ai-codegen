import type { ConnectionOptions, Job, JobsOptions } from "bullmq";
import { Queue, QueueEvents, Worker } from "bullmq";
import { z } from "zod";
import { CodegenType } from "../generated/prisma/enums.js";
import type { MetricsService } from "../observability/index.js";
import type { ScreenshotCaptureInput, ScreenshotJob } from "./screenshot-service.js";

export const screenshotQueuePayloadSchema = z.object({
  appId: z.string().regex(/^\d+$/u),
  codegenType: z.enum(CodegenType),
  deployUrl: z.url(),
});

export type ScreenshotQueuePayload = z.infer<typeof screenshotQueuePayloadSchema>;

export type ScreenshotQueue = Readonly<{
  add: (name: string, payload: ScreenshotQueuePayload, options: JobsOptions) => Promise<unknown>;
  close?: () => Promise<void>;
}>;

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { delay: 5000, type: "exponential" },
  removeOnComplete: true,
  removeOnFail: 100,
};

export const createBullMqScreenshotQueue = (connection: ConnectionOptions): ScreenshotQueue =>
  new Queue<ScreenshotQueuePayload>("screenshot", { connection });

export const createQueuedScreenshotJob = (queue: ScreenshotQueue): ScreenshotJob => ({
  enqueue: async (input: ScreenshotCaptureInput) => {
    await queue.add(
      "capture",
      {
        appId: input.app.id.toString(),
        codegenType: input.app.codegenType,
        deployUrl: input.deployUrl,
      },
      defaultJobOptions,
    );
  },
});

export type ScreenshotQueueProcessor = Readonly<{
  process: (payload: ScreenshotQueuePayload) => Promise<void>;
}>;

export const createScreenshotQueueProcessor = (
  screenshotJob: ScreenshotJob,
): ScreenshotQueueProcessor => ({
  process: async (payload) => {
    await screenshotJob.enqueue({
      app: {
        codegenType: payload.codegenType,
        id: BigInt(payload.appId),
      },
      deployUrl: payload.deployUrl,
    });
  },
});

export const createBullMqScreenshotWorker = (
  connection: ConnectionOptions,
  processor: ScreenshotQueueProcessor,
): Worker<ScreenshotQueuePayload> =>
  new Worker<ScreenshotQueuePayload>(
    "screenshot",
    async (job: Job<ScreenshotQueuePayload>) => {
      const payload = screenshotQueuePayloadSchema.parse(job.data);
      await processor.process(payload);
    },
    { connection },
  );

export const createScreenshotQueueFailureObserver = (
  connection: ConnectionOptions,
  metrics: MetricsService,
): QueueEvents => {
  const events = new QueueEvents("screenshot", { connection });
  events.on("failed", () => {
    metrics.recordScreenshotFailure({ source: "queue" });
    metrics.recordAiError({
      errorType: "screenshot_queue_failed",
      modelRole: "none",
    });
  });
  return events;
};
