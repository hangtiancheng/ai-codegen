import {
  InstallSkillTool,
  SkillCatalog,
  type SkillMeta,
  type ToolContext,
} from "@swifty.js/swifty";

export type SkillVo = Readonly<{
  name: string;
  description: string;
  mode: "inline" | "fork";
  model?: string;
}>;

const toVo = (meta: SkillMeta): SkillVo => ({
  description: meta.description,
  mode: meta.mode ?? "inline",
  name: meta.name,
  ...(meta.model !== undefined && { model: meta.model }),
});

/**
 * Read/administer the skills available in a workspace directory. Uses the
 * public SkillCatalog + InstallSkillTool; every call re-scans the workDir so it
 * reflects on-disk changes without needing the live agent handle.
 */
export const createSkillRuntime = (workDir: string) => {
  const catalog = new SkillCatalog();
  catalog.load(workDir);

  const list = (): SkillVo[] => {
    if (catalog.needsReload()) catalog.reload();
    return catalog.list().map(toVo);
  };

  const reload = (): SkillVo[] => {
    catalog.reload();
    return catalog.list().map(toVo);
  };

  const install = async (
    source: string,
    name?: string,
  ): Promise<{ ok: boolean; output: string }> => {
    const tool = new InstallSkillTool(workDir, catalog);
    const ctx: ToolContext = { workDir };
    const result = await tool.execute(ctx, { source, ...(name !== undefined && { name }) });
    catalog.reload();
    const output =
      typeof result.output === "string" ? result.output : JSON.stringify(result.output);
    return { ok: !result.isError, output };
  };

  return { install, list, reload };
};
