import { Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import type { AppId } from "@/shared/schemas";
import { Button } from "@/shared/ui";
import {
  clearAgentMemory,
  createMcpServer,
  deleteMcpServer,
  getAgentSettings,
  listAgentMemory,
  listAgentSessions,
  listAgentSkills,
  listMcpServers,
  mcpTransports,
  type McpCreateInput,
  type McpTransport,
  PERMISSION_MODES,
  reloadAgentSkills,
  resumeAgentSession,
  testMcpServer,
  updateAgentSettings,
} from "./capability-api";

type TabId = "mcp" | "skills" | "settings" | "sessions" | "memory";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "mcp", label: "MCP" },
  { id: "skills", label: "Skills" },
  { id: "settings", label: "Settings" },
  { id: "sessions", label: "Sessions" },
  { id: "memory", label: "Memory" },
];

export type CapabilityDrawerProps = {
  readonly appId: AppId;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly canManage: boolean;
  readonly onNewSession: () => void;
};

export function CapabilityDrawer({
  appId,
  open,
  onClose,
  canManage,
  onNewSession,
}: CapabilityDrawerProps): ReactNode {
  const [tab, setTab] = useState<TabId>("mcp");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        className="bg-background/60 absolute inset-0"
        onClick={onClose}
      />
      <aside className="border-border bg-card relative flex h-full w-full max-w-md flex-col border-l shadow-xl">
        <header className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Capabilities</h2>
          <button type="button" onClick={onClose} aria-label="Close drawer">
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>
        <div
          role="tablist"
          className="border-border flex gap-1 border-b px-2 py-2"
        >
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium",
                tab === entry.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "mcp" ? (
            <McpTab appId={appId} canManage={canManage} />
          ) : null}
          {tab === "skills" ? (
            <SkillsTab appId={appId} canManage={canManage} />
          ) : null}
          {tab === "settings" ? (
            <SettingsTab appId={appId} canManage={canManage} />
          ) : null}
          {tab === "sessions" ? (
            <SessionsTab
              appId={appId}
              canManage={canManage}
              onNewSession={onNewSession}
            />
          ) : null}
          {tab === "memory" ? (
            <MemoryTab appId={appId} canManage={canManage} />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function useAsync<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const reload = useCallback(() => {
    setLoading(true);
    setError(undefined);
    load()
      .then((value) => setData(value))
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Request failed"),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, loading, error, reload, setData };
}

function StatusLine({
  loading,
  error,
}: {
  readonly loading: boolean;
  readonly error: string | undefined;
}): ReactNode {
  if (loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading…
      </p>
    );
  }
  if (error !== undefined)
    return <p className="text-destructive text-sm">{error}</p>;
  return null;
}

function McpTab({
  appId,
  canManage,
}: {
  readonly appId: AppId;
  readonly canManage: boolean;
}): ReactNode {
  const { data, loading, error, reload } = useAsync(() =>
    listMcpServers(appId),
  );
  const [adding, setAdding] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  if (!canManage) {
    return (
      <p className="text-muted-foreground text-sm">
        Owner or admin access required.
      </p>
    );
  }

  const runTest = (id: string): void => {
    setTestResult((current) => ({ ...current, [id]: "testing…" }));
    testMcpServer(appId, id)
      .then((result) =>
        setTestResult((current) => ({
          ...current,
          [id]: result.connected
            ? `connected · ${String(result.toolCount)} tools`
            : (result.error ?? "failed"),
        })),
      )
      .catch((cause: unknown) =>
        setTestResult((current) => ({
          ...current,
          [id]: cause instanceof Error ? cause.message : "failed",
        })),
      );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">MCP servers</h3>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={reload}
            aria-label="Refresh"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAdding((value) => !value)}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add
          </Button>
        </div>
      </div>
      <StatusLine loading={loading} error={error} />
      {adding ? (
        <McpForm
          appId={appId}
          onDone={() => {
            setAdding(false);
            reload();
          }}
        />
      ) : null}
      <ul className="space-y-2">
        {(data ?? []).map((server) => (
          <li
            key={server.id}
            className="border-border rounded-lg border p-2.5 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{server.name}</span>
              <span className="text-muted-foreground/70 text-[10px] uppercase">
                {server.transport}
              </span>
              <span
                className={cn(
                  "ml-auto rounded px-1.5 py-0.5 text-[10px]",
                  server.status === "CONNECTED"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : server.status === "ERROR"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {server.status.toLowerCase()}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
              {server.command ?? server.url ?? ""}
            </p>
            {testResult[server.id] !== undefined ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {testResult[server.id]}
              </p>
            ) : null}
            <div className="mt-2 flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => runTest(server.id)}
              >
                Test
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void deleteMcpServer(appId, server.id).then(reload);
                }}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
        {!loading && (data ?? []).length === 0 ? (
          <li className="text-muted-foreground text-sm">
            No MCP servers configured.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

type KeyValue = { key: string; value: string };

function McpForm({
  appId,
  onDone,
}: {
  readonly appId: AppId;
  readonly onDone: () => void;
}): ReactNode {
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<McpTransport>("stdio");
  const [command, setCommand] = useState("");
  const [url, setUrl] = useState("");
  const [secrets, setSecrets] = useState<KeyValue[]>([]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const submit = (): void => {
    setSaving(true);
    setError(undefined);
    const secretMap = Object.fromEntries(
      secrets
        .filter((row) => row.key.trim().length > 0)
        .map((row) => [row.key.trim(), row.value]),
    );
    const [cmd, ...args] = command.trim().split(/\s+/u).filter(Boolean);
    const body: McpCreateInput = {
      name: name.trim(),
      transport,
      ...(transport === "stdio"
        ? {
            command: cmd ?? "",
            args,
            ...(Object.keys(secretMap).length > 0 && { env: secretMap }),
          }
        : {
            url: url.trim(),
            ...(Object.keys(secretMap).length > 0 && { headers: secretMap }),
          }),
    };
    createMcpServer(appId, body)
      .then(() => onDone())
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Failed to create server",
        ),
      )
      .finally(() => setSaving(false));
  };

  return (
    <div className="border-border bg-muted/20 space-y-2 rounded-lg border p-3">
      <input
        className="border-border bg-background w-full rounded-md border px-2 py-1 text-sm"
        placeholder="Name (letters, digits, . _ -)"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <select
        className="border-border bg-background w-full rounded-md border px-2 py-1 text-sm"
        value={transport}
        onChange={(event) =>
          setTransport(
            mcpTransports.find((value) => value === event.target.value) ??
              "stdio",
          )
        }
      >
        {mcpTransports.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      {transport === "stdio" ? (
        <input
          className="border-border bg-background w-full rounded-md border px-2 py-1 font-mono text-sm"
          placeholder="Command, e.g. npx -y @modelcontextprotocol/server-filesystem ."
          value={command}
          onChange={(event) => setCommand(event.target.value)}
        />
      ) : (
        <input
          className="border-border bg-background w-full rounded-md border px-2 py-1 font-mono text-sm"
          placeholder="https://server.example.com/sse"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      )}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {transport === "stdio" ? "Env" : "Headers"} (secret)
          </span>
          <button
            type="button"
            className="text-primary text-xs"
            onClick={() =>
              setSecrets((rows) => [...rows, { key: "", value: "" }])
            }
          >
            + add
          </button>
        </div>
        {secrets.map((row, index) => (
          <div key={index} className="flex gap-1">
            <input
              className="border-border bg-background w-1/3 rounded-md border px-2 py-1 text-xs"
              placeholder="KEY"
              value={row.key}
              onChange={(event) =>
                setSecrets((rows) =>
                  rows.map((item, i) =>
                    i === index ? { ...item, key: event.target.value } : item,
                  ),
                )
              }
            />
            <input
              className="border-border bg-background flex-1 rounded-md border px-2 py-1 text-xs"
              placeholder="value"
              type="password"
              value={row.value}
              onChange={(event) =>
                setSecrets((rows) =>
                  rows.map((item, i) =>
                    i === index ? { ...item, value: event.target.value } : item,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>
      {error !== undefined ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : null}
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={saving || name.trim().length === 0}
          onClick={submit}
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          Create
        </Button>
      </div>
    </div>
  );
}

function SkillsTab({
  appId,
  canManage,
}: {
  readonly appId: AppId;
  readonly canManage: boolean;
}): ReactNode {
  const { data, loading, error, setData } = useAsync(() =>
    listAgentSkills(appId),
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Skills ({(data ?? []).length})
        </h3>
        {canManage ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void reloadAgentSkills(appId).then(setData);
            }}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Reload
          </Button>
        ) : null}
      </div>
      <StatusLine loading={loading} error={error} />
      <ul className="space-y-1.5">
        {(data ?? []).map((skill) => (
          <li
            key={skill.name}
            className="border-border rounded-lg border p-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">/{skill.name}</span>
              <span className="text-muted-foreground/70 text-[10px] uppercase">
                {skill.mode}
              </span>
            </div>
            {skill.description.length > 0 ? (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {skill.description}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsTab({
  appId,
  canManage,
}: {
  readonly appId: AppId;
  readonly canManage: boolean;
}): ReactNode {
  const { data, loading, error, setData } = useAsync(() =>
    getAgentSettings(appId),
  );
  const [saving, setSaving] = useState(false);

  const patch = (body: Parameters<typeof updateAgentSettings>[1]): void => {
    setSaving(true);
    updateAgentSettings(appId, body)
      .then(setData)
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Settings</h3>
      <StatusLine loading={loading} error={error} />
      {data !== undefined ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground text-xs">
              Permission mode
            </span>
            <select
              className="border-border bg-background mt-1 w-full rounded-md border px-2 py-1 text-sm"
              value={data.permissionMode}
              disabled={!canManage || saving}
              onChange={(event) =>
                patch({
                  permissionMode:
                    PERMISSION_MODES.find(
                      (mode) => mode === event.target.value,
                    ) ?? "BYPASS_PERMISSIONS",
                })
              }
            >
              {PERMISSION_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          {(["sandboxEnabled", "memoryEnabled", "hooksEnabled"] as const).map(
            (key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={data[key]}
                  disabled={!canManage || saving}
                  onChange={(event) => patch({ [key]: event.target.checked })}
                />
                {key.replace(/Enabled$/, "")}
              </label>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function SessionsTab({
  appId,
  canManage,
  onNewSession,
}: {
  readonly appId: AppId;
  readonly canManage: boolean;
  readonly onNewSession: () => void;
}): ReactNode {
  const { data, loading, error, reload } = useAsync(() =>
    listAgentSessions(appId),
  );
  const [resumingId, setResumingId] = useState<string>();

  const resume = async (sessionId: string): Promise<void> => {
    setResumingId(sessionId);
    try {
      await resumeAgentSession(appId, sessionId);
      reload();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Unable to resume session",
      );
    } finally {
      setResumingId(undefined);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Sessions</h3>
        {canManage ? (
          <Button size="sm" variant="secondary" onClick={onNewSession}>
            <Plus className="size-3.5" aria-hidden="true" />
            New
          </Button>
        ) : null}
      </div>
      <StatusLine loading={loading} error={error} />
      <ul className="space-y-1.5">
        {(data ?? []).map((session) => (
          <li
            key={session.id}
            className="border-border rounded-lg border p-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-xs">
                {session.id.slice(0, 8)}
              </span>
              <span className="text-muted-foreground/70 text-[10px] uppercase">
                {session.status.toLowerCase()}
              </span>
              {canManage ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  disabled={
                    resumingId !== undefined ||
                    session.status === "RUNNING" ||
                    session.status === "WAITING"
                  }
                  onClick={() => {
                    void resume(session.id);
                  }}
                >
                  {resumingId === session.id ? "Resuming…" : "Resume"}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MemoryTab({
  appId,
  canManage,
}: {
  readonly appId: AppId;
  readonly canManage: boolean;
}): ReactNode {
  const { data, loading, error, reload } = useAsync(() =>
    listAgentMemory(appId),
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Memory ({(data ?? []).length})
        </h3>
        {canManage && (data ?? []).length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void clearAgentMemory(appId).then(reload);
            }}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Clear
          </Button>
        ) : null}
      </div>
      <StatusLine loading={loading} error={error} />
      <ul className="space-y-1.5">
        {(data ?? []).map((file) => (
          <li
            key={file.path}
            className="border-border rounded-lg border p-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{file.name}</span>
              <span className="text-muted-foreground/70 text-[10px] uppercase">
                {file.type}
              </span>
            </div>
            {file.description.length > 0 ? (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {file.description}
              </p>
            ) : null}
          </li>
        ))}
        {!loading && (data ?? []).length === 0 ? (
          <li className="text-muted-foreground text-sm">No memory files.</li>
        ) : null}
      </ul>
    </div>
  );
}
