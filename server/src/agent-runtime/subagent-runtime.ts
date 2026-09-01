import { type AgentDefinition, loadAgentDefinitions } from "@swifty.js/swifty";

export type SubagentVo = Readonly<{
  name: string;
  description: string;
  model?: string;
  background: boolean;
  isolation?: "worktree";
}>;

/** Lists the built-in + user + project subagent definitions for a workDir. */
export const listSubagents = (workDir: string): SubagentVo[] =>
  loadAgentDefinitions(workDir).map((definition: AgentDefinition) => ({
    background: definition.background ?? false,
    description: definition.description,
    name: definition.name,
    ...(definition.model !== undefined && { model: definition.model }),
    ...(definition.isolation !== undefined && { isolation: definition.isolation }),
  }));
