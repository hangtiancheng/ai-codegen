import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { promptSchema, createSuccessResponse } from "../common/index.js";
import { CodegenType } from "../generated/prisma/enums.js";
import type { AppHonoEnv } from "../session/index.js";
import { createWorkflowSseResponse } from "../workflow/index.js";
import type { WorkflowSseEvent } from "../workflow/workflow-events.schema.js";

const workflowPromptSchema = z.object({
  prompt: promptSchema,
});

type WorkflowPrompt = z.infer<typeof workflowPromptSchema>;

const demoResult = (input: WorkflowPrompt) => ({
  codegenType: CodegenType.VANILLA_HTML,
  prompt: input.prompt,
  status: "demo" as const,
});

async function* demoWorkflowEvents(
  input: WorkflowPrompt,
): AsyncGenerator<WorkflowSseEvent> {
  yield {
    data: { appId: "demo", message: "Workflow demo started" },
    event: "workflow-start",
  };
  yield {
    data: { d: input.prompt },
    event: "chunk",
  };
  yield {
    data: {},
    event: "done",
  };
}

export const workflowDemoRoutes = new Hono<AppHonoEnv>()
  .post("/execute", zValidator("json", workflowPromptSchema), (c) =>
    c.json(createSuccessResponse(demoResult(c.req.valid("json")))),
  )
  .get("/execute-flux", zValidator("query", workflowPromptSchema), (c) =>
    createWorkflowSseResponse(demoWorkflowEvents(c.req.valid("query"))),
  )
  .get("/execute-sse", zValidator("query", workflowPromptSchema), (c) =>
    createWorkflowSseResponse(demoWorkflowEvents(c.req.valid("query"))),
  );

export type WorkflowDemoRoutes = typeof workflowDemoRoutes;
