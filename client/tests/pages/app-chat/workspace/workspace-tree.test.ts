import type { FileSystemTree } from "@webcontainer/api";
import { describe, expect, it } from "vitest";
import type { AgentFileTreeNode } from "@/shared/schemas";
import {
  agentTreeToFileSystem,
  snapshotFromAgentTree,
  sortNodes,
  threeWayMerge,
  type WorkspaceNode,
} from "@/pages/app-chat/workspace/workspace-tree";

function fileNode(
  path: string,
  name: string,
  contents: string,
  encoding: "utf8" | "base64",
  hash: string,
): AgentFileTreeNode {
  return { type: "file", path, name, encoding, contents, hash };
}

function dirNode(
  path: string,
  name: string,
  children: AgentFileTreeNode[],
): AgentFileTreeNode {
  return { type: "directory", path, name, children };
}

/** Narrow a FileSystemTree entry to its file contents. */
function fileContents(tree: FileSystemTree, name: string): string | Uint8Array {
  const entry = tree[name];
  if (!entry || !("file" in entry) || !("contents" in entry.file)) {
    throw new Error(`no file entry: ${name}`);
  }
  return entry.file.contents;
}

function directoryTree(tree: FileSystemTree, name: string): FileSystemTree {
  const entry = tree[name];
  if (!entry || !("directory" in entry)) {
    throw new Error(`no directory entry: ${name}`);
  }
  return entry.directory;
}

describe("threeWayMerge", () => {
  it("returns local when local and server agree (identical edits)", () => {
    const result = threeWayMerge("base", "same", "same");
    expect(result).toEqual({ clean: true, text: "same" });
  });

  it("takes the server side when only the server diverged from base", () => {
    // base === local, so the local side never changed.
    const result = threeWayMerge("base", "base", "server-change");
    expect(result).toEqual({ clean: true, text: "server-change" });
  });

  it("takes the local side when only the local side diverged from base", () => {
    // base === server, so the server never changed.
    const result = threeWayMerge("base", "local-change", "base");
    expect(result).toEqual({ clean: true, text: "local-change" });
  });

  it("reports a conflict when all three differ", () => {
    const result = threeWayMerge("base", "local", "server");
    expect(result).toEqual({ clean: false });
  });
});

describe("sortNodes", () => {
  it("orders directories before files, each case-insensitively alphabetical", () => {
    const nodes: WorkspaceNode[] = [
      { kind: "file", name: "Zebra.ts", path: "Zebra.ts", binary: false },
      { kind: "directory", name: "alpha", path: "alpha", children: [] },
      { kind: "file", name: "apple.ts", path: "apple.ts", binary: false },
      { kind: "directory", name: "Beta", path: "Beta", children: [] },
      { kind: "file", name: "banana.ts", path: "banana.ts", binary: false },
    ];
    expect(sortNodes(nodes).map((node) => node.name)).toEqual([
      "alpha",
      "Beta",
      "apple.ts",
      "banana.ts",
      "Zebra.ts",
    ]);
  });

  it("does not mutate the input array", () => {
    const nodes: WorkspaceNode[] = [
      { kind: "file", name: "b.ts", path: "b.ts", binary: false },
      { kind: "file", name: "a.ts", path: "a.ts", binary: false },
    ];
    const snapshot = nodes.map((node) => node.name);
    sortNodes(nodes);
    expect(nodes.map((node) => node.name)).toEqual(snapshot);
  });
});

describe("agentTreeToFileSystem", () => {
  it("returns an empty tree when the root is a file", () => {
    expect(
      agentTreeToFileSystem(fileNode("a.ts", "a.ts", "x", "utf8", "h")),
    ).toEqual({});
  });

  it("keeps utf8 files as strings and decodes base64 files to bytes", () => {
    const tree = agentTreeToFileSystem(
      dirNode("", "root", [
        fileNode("app.ts", "app.ts", "const x = 1;", "utf8", "h1"),
        // "aGVsbG8=" is base64 for "hello".
        fileNode("logo.bin", "logo.bin", "aGVsbG8=", "base64", "h2"),
      ]),
    );

    expect(fileContents(tree, "app.ts")).toBe("const x = 1;");

    const decoded = fileContents(tree, "logo.bin");
    expect(decoded).toBeInstanceOf(Uint8Array);
    if (!(decoded instanceof Uint8Array))
      throw new Error("expected binary contents");
    expect(new TextDecoder().decode(decoded)).toBe("hello");
  });

  it("nests directories and skips ignored directories", () => {
    const tree = agentTreeToFileSystem(
      dirNode("", "root", [
        dirNode("src", "src", [
          fileNode("src/index.ts", "index.ts", "export {};", "utf8", "h1"),
        ]),
        dirNode("node_modules", "node_modules", [
          fileNode("node_modules/pkg.js", "pkg.js", "junk", "utf8", "h2"),
        ]),
      ]),
    );

    expect(Object.keys(tree)).toEqual(["src"]);
    const src = directoryTree(tree, "src");
    expect(fileContents(src, "index.ts")).toBe("export {};");
  });
});

describe("snapshotFromAgentTree", () => {
  it("returns empty nodes and files when the root is a file", () => {
    const snapshot = snapshotFromAgentTree(
      fileNode("a.ts", "a.ts", "x", "utf8", "h"),
    );
    expect(snapshot.nodes).toEqual([]);
    expect(snapshot.files.size).toBe(0);
  });

  it("builds sorted nodes, records file contents/hashes, and skips ignored dirs", () => {
    const root = dirNode("", "root", [
      dirNode("node_modules", "node_modules", [
        fileNode("node_modules/pkg.js", "pkg.js", "junk", "utf8", "hx"),
      ]),
      dirNode("src", "src", [
        fileNode("src/App.tsx", "App.tsx", "code", "utf8", "h1"),
      ]),
      fileNode("notes.txt", "notes.txt", "hello notes", "utf8", "h2"),
      fileNode("data.bin", "data.bin", "AAAA", "base64", "h3"),
      // utf8 encoding but a binary extension: treated as binary, text dropped.
      fileNode("logo.png", "logo.png", "not-real-text", "utf8", "h4"),
    ]);

    const { nodes, files } = snapshotFromAgentTree(root);

    // node_modules is skipped; directory sorts before files, files alphabetical.
    expect(nodes.map((node) => node.name)).toEqual([
      "src",
      "data.bin",
      "logo.png",
      "notes.txt",
    ]);

    expect(files.get("src/App.tsx")).toEqual({
      binary: false,
      text: "code",
      hash: "h1",
    });
    expect(files.get("notes.txt")).toEqual({
      binary: false,
      text: "hello notes",
      hash: "h2",
    });
    // base64 encoded -> binary, text withheld.
    expect(files.get("data.bin")).toEqual({
      binary: true,
      text: undefined,
      hash: "h3",
    });
    // utf8 but binary by extension -> binary, text withheld.
    expect(files.get("logo.png")).toEqual({
      binary: true,
      text: undefined,
      hash: "h4",
    });
    // The ignored directory contributed nothing to the file map.
    expect(files.has("node_modules/pkg.js")).toBe(false);
  });
});
