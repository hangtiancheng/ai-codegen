import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { parentPath } from "./workspace-paths";
import { useWorkspace } from "./workspace-context";
import type { WorkspaceNode } from "./workspace-tree";

/**
 * Recursive project explorer with create/rename/delete/refresh actions and
 * dirty/conflict badges. All mutations are disabled while the agent is running
 * so its file writes are not raced by the user.
 */
export function FileExplorer(): ReactNode {
  const workspace = useWorkspace();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [selectedDir, setSelectedDir] = useState("");
  const disabled = workspace.agentRunning || workspace.busy;

  const runMutation = (operation: Promise<void>): void => {
    void operation.catch((cause: unknown) => {
      toast.error(
        cause instanceof Error ? cause.message : "Workspace operation failed",
      );
    });
  };

  const toggle = (path: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const promptCreateFile = (): void => {
    const name = globalThis.prompt("New file name (relative to selection)");
    if (name === null || name.trim() === "") return;
    runMutation(workspace.createFile(selectedDir, name.trim()));
  };

  const promptCreateFolder = (): void => {
    const name = globalThis.prompt("New folder name (relative to selection)");
    if (name === null || name.trim() === "") return;
    runMutation(workspace.createDirectory(selectedDir, name.trim()));
  };

  const promptRename = (path: string): void => {
    const next = globalThis.prompt("Rename to", path);
    if (next === null || next.trim() === "" || next.trim() === path) return;
    runMutation(workspace.renamePath(path, next.trim()));
  };

  const confirmDelete = (path: string): void => {
    if (!globalThis.confirm(`Delete ${path}?`)) return;
    runMutation(workspace.deletePath(path));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex items-center justify-between gap-1 border-b px-2 py-1.5">
        <span className="text-muted-foreground truncate text-xs font-medium">
          {selectedDir === "" ? "Explorer" : selectedDir}
        </span>
        <div className="flex items-center gap-0.5">
          <IconButton
            label="New file"
            onClick={promptCreateFile}
            disabled={disabled}
          >
            <FilePlus className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label="New folder"
            onClick={promptCreateFolder}
            disabled={disabled}
          >
            <FolderPlus className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Refresh"
            onClick={workspace.refreshTree}
            disabled={disabled}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {workspace.treeLoading && workspace.tree.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-xs">Loading…</p>
        ) : null}
        {!workspace.treeLoading && workspace.tree.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-xs">
            No files yet.
          </p>
        ) : null}
        <ul>
          {workspace.tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              collapsed={collapsed}
              selectedDir={selectedDir}
              activePath={workspace.activePath}
              disabled={disabled}
              onToggle={toggle}
              onSelectDir={setSelectedDir}
              onOpen={workspace.openFile}
              onRename={promptRename}
              onDelete={confirmDelete}
              getBadge={(path) => {
                const file = workspace.getFileState(path);
                if (file?.conflict !== undefined) return "conflict";
                if (file?.dirty === true) return "dirty";
                return "none";
              }}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

type BadgeKind = "none" | "dirty" | "conflict";

type TreeItemProps = {
  readonly node: WorkspaceNode;
  readonly depth: number;
  readonly collapsed: ReadonlySet<string>;
  readonly selectedDir: string;
  readonly activePath: string | undefined;
  readonly disabled: boolean;
  readonly onToggle: (path: string) => void;
  readonly onSelectDir: (path: string) => void;
  readonly onOpen: (path: string) => void;
  readonly onRename: (path: string) => void;
  readonly onDelete: (path: string) => void;
  readonly getBadge: (path: string) => BadgeKind;
};

function TreeItem({
  node,
  depth,
  collapsed,
  selectedDir,
  activePath,
  disabled,
  onToggle,
  onSelectDir,
  onOpen,
  onRename,
  onDelete,
  getBadge,
}: TreeItemProps): ReactNode {
  const indent = { paddingLeft: `${depth * 12 + 8}px` };
  if (node.kind === "directory") {
    const isCollapsed = collapsed.has(node.path);
    return (
      <li>
        <div
          className={cn(
            "group flex items-center gap-1 py-1 pr-2 text-sm",
            "hover:bg-secondary/60",
            selectedDir === node.path && "bg-secondary/40",
          )}
          style={indent}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 text-left"
            onClick={() => {
              onToggle(node.path);
              onSelectDir(node.path);
            }}
          >
            {isCollapsed ? (
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          <NodeActions
            disabled={disabled}
            onRename={() => onRename(node.path)}
            onDelete={() => onDelete(node.path)}
          />
        </div>
        {isCollapsed ? null : (
          <ul>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                collapsed={collapsed}
                selectedDir={selectedDir}
                activePath={activePath}
                disabled={disabled}
                onToggle={onToggle}
                onSelectDir={onSelectDir}
                onOpen={onOpen}
                onRename={onRename}
                onDelete={onDelete}
                getBadge={getBadge}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }
  const badge = getBadge(node.path);
  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 py-1 pr-2 text-sm",
          "hover:bg-secondary/60",
          activePath === node.path && "bg-secondary/70",
        )}
        style={indent}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => {
            onSelectDir(parentPath(node.path));
            onOpen(node.path);
          }}
        >
          <span className="truncate">{node.name}</span>
          {badge === "dirty" ? (
            <span
              className="size-1.5 shrink-0 rounded-full bg-amber-500"
              aria-label="Unsaved changes"
            />
          ) : null}
          {badge === "conflict" ? (
            <span className="text-destructive shrink-0 text-[10px] font-semibold uppercase">
              conflict
            </span>
          ) : null}
        </button>
        <NodeActions
          disabled={disabled}
          onRename={() => onRename(node.path)}
          onDelete={() => onDelete(node.path)}
        />
      </div>
    </li>
  );
}

function NodeActions({
  disabled,
  onRename,
  onDelete,
}: {
  readonly disabled: boolean;
  readonly onRename: () => void;
  readonly onDelete: () => void;
}): ReactNode {
  return (
    <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
      <IconButton label="Rename" onClick={onRename} disabled={disabled}>
        <Pencil className="size-3.5" aria-hidden="true" />
      </IconButton>
      <IconButton label="Delete" onClick={onDelete} disabled={disabled}>
        <Trash2 className="size-3.5" aria-hidden="true" />
      </IconButton>
    </span>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-7 p-0"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
