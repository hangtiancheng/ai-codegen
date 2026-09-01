import {
  BashTool,
  EditFileTool,
  GlobTool,
  GrepTool,
  ReadFileTool,
  ToolRegistry,
  WriteFileTool,
} from "@swifty.js/swifty";

export const createCodegenToolRegistry = (): ToolRegistry => {
  const registry = new ToolRegistry();
  registry.register(new ReadFileTool());
  registry.register(new WriteFileTool());
  registry.register(new EditFileTool());
  registry.register(new GlobTool());
  registry.register(new GrepTool());
  registry.register(new BashTool());
  return registry;
};
