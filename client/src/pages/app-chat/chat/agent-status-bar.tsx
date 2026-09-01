import { SlidersHorizontal } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/shared/lib";
import type {
  AgentConnectionState,
  AgentRuntimeStatus,
} from "../use-agent-transcript";

const CONNECTION_LABEL: Record<AgentConnectionState, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  handshaking: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
};

const RUNTIME_LABEL: Record<AgentRuntimeStatus, string> = {
  idle: "Ready",
  running: "Running",
  waiting: "Waiting",
  stopped: "Stopped",
  error: "Error",
};

export type AgentStatusBarProps = {
  readonly connectionState: AgentConnectionState;
  readonly runtimeStatus: AgentRuntimeStatus;
  readonly permissionMode: string | undefined;
  readonly readOnly: boolean;
  readonly onOpenCapabilities: () => void;
};

export function AgentStatusBar({
  connectionState,
  runtimeStatus,
  permissionMode,
  readOnly,
  onOpenCapabilities,
}: AgentStatusBarProps): ReactNode {
  const connected = connectionState === "connected";
  const busy = runtimeStatus === "running" || runtimeStatus === "waiting";
  return (
    <div className="border-border text-muted-foreground flex items-center gap-3 border-b px-4 py-2 text-xs">
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-2 rounded-full",
            connected
              ? "bg-emerald-500"
              : connectionState === "disconnected"
                ? "bg-destructive"
                : "bg-amber-500",
          )}
          aria-hidden="true"
        />
        {CONNECTION_LABEL[connectionState]}
      </span>
      <span className={cn("flex items-center gap-1.5", busy && "text-primary")}>
        {RUNTIME_LABEL[runtimeStatus]}
      </span>
      {permissionMode !== undefined ? (
        <span className="ml-auto font-mono text-[10px] uppercase opacity-70">
          {permissionMode.replace(/_/g, " ").toLowerCase()}
        </span>
      ) : (
        <span className="ml-auto" />
      )}
      {readOnly ? (
        <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium">
          read-only
        </span>
      ) : null}
      <button
        type="button"
        onClick={onOpenCapabilities}
        className="hover:text-foreground flex items-center gap-1"
        aria-label="Open capabilities"
      >
        <SlidersHorizontal className="size-3.5" aria-hidden="true" />
        Capabilities
      </button>
    </div>
  );
}
