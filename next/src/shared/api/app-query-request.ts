import { type AppQueryRequest, appQueryRequestSchema } from "@/shared/schemas";

export function mapAppQueryRequest(body: AppQueryRequest): unknown {
  return appQueryRequestSchema.parse(body);
}
