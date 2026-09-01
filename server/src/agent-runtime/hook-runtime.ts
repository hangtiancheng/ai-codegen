import type { HookConfig } from "@swifty.js/swifty";
import type { AgentHookModel } from "../generated/prisma/models/AgentHook.js";
import { toSwiftyHookConfig } from "./hook-config.js";

/** Maps enabled DB hook rows into the Swifty HookConfig[] a HookEngine consumes. */
export const buildHookConfigs = (rows: readonly AgentHookModel[]): HookConfig[] =>
  rows.filter((row) => row.enabled).map(toSwiftyHookConfig);
