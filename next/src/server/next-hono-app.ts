import { createApp, createDefaultDependencies } from "@/server/app";

const dependencies = createDefaultDependencies();
const honoApp = createApp(dependencies);

export async function handleHonoRequest(request: Request): Promise<Response> {
  return honoApp.fetch(request);
}
