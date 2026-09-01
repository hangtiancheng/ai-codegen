import type { TeamManager } from "@swifty.js/swifty";

export type TeamVo = Readonly<{
  name: string;
  mode: string;
  description?: string | undefined;
  memberCount: number;
  members: ReadonlyArray<{ name: string; active: boolean; agentType?: string | undefined }>;
}>;

export type TeamTaskVo = Readonly<{
  id: string;
  title: string;
  status: string;
  assignee: string;
}>;

/** Read-only projection of the live TeamManager for capability endpoints. */
export const listTeams = (teamManager: TeamManager): TeamVo[] =>
  teamManager.list().map((team) => ({
    memberCount: team.members.size,
    members: [...team.members.values()].map((member) => ({
      active: member.active,
      name: member.name,
      ...(member.agentType !== undefined && { agentType: member.agentType }),
    })),
    mode: team.mode,
    name: team.name,
    ...(team.description !== undefined && { description: team.description }),
  }));

export const listTeamTasks = (teamManager: TeamManager, teamName: string): TeamTaskVo[] => {
  const store = teamManager.getTaskStore(teamName);
  return store.listTasks().map((task) => ({
    assignee: task.assignee,
    id: task.id,
    status: task.status,
    title: task.title,
  }));
};
