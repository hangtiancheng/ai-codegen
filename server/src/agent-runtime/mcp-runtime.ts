import { MCPManager, type MCPServerConfig } from "@swifty.js/swifty";

export type McpTestResult = Readonly<{
  connected: boolean;
  toolCount: number;
  error?: string;
}>;

/**
 * Tests a single MCP server config by connecting through a throwaway
 * MCPManager. Always disconnects in `finally` so the probe leaves no live
 * client. Never logs the config (it carries decrypted secrets).
 */
export const testMcpConnection = async (config: MCPServerConfig): Promise<McpTestResult> => {
  const manager = new MCPManager();
  try {
    const result = await manager.connectAll([config]);
    const connected = result.servers.includes(config.name);
    const failure = result.errors.find((entry) => entry.serverName === config.name);
    return {
      connected,
      toolCount: result.tools.filter((tool) => tool.serverName === config.name).length,
      ...(failure !== undefined && { error: String(failure.error) }),
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "unknown error",
      toolCount: 0,
    };
  } finally {
    await manager.disconnectAll().catch(() => {
      /* best-effort cleanup */
    });
  }
};
