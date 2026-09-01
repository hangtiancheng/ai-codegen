import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import { type ITheme, Terminal } from "@xterm/xterm";
import { useEffect, useRef, type ReactNode } from "react";
import { useWorkspace } from "./workspace-context";

// Light terminal palette (GitHub-light inspired) so the integrated shell matches
// the rest of the light IDE. ANSI colors are chosen for contrast on white.
const LIGHT_TERMINAL_THEME: ITheme = {
  background: "#ffffff",
  foreground: "#1f2328",
  cursor: "#1f2328",
  cursorAccent: "#ffffff",
  selectionBackground: "#b3d4fc",
  black: "#1f2328",
  red: "#cf222e",
  green: "#116329",
  yellow: "#7d4e00",
  blue: "#0969da",
  magenta: "#8250df",
  cyan: "#1b7c83",
  white: "#6e7781",
  brightBlack: "#57606a",
  brightRed: "#a40e26",
  brightGreen: "#1a7f37",
  brightYellow: "#633c01",
  brightBlue: "#218bff",
  brightMagenta: "#a475f9",
  brightCyan: "#3192aa",
  brightWhite: "#8c959f",
};

/**
 * Integrated `jsh` terminal. It wires the workspace shell to a single xterm
 * surface, keeps the fit addon in sync through a ResizeObserver, and blocks
 * input while the agent is running so its writes are not disturbed.
 */
export function WorkspaceTerminal(): ReactNode {
  const workspace = useWorkspace();
  const attachTerminal = workspace.attachTerminal;
  const containerRef = useRef<HTMLDivElement>(null);
  const agentRunningRef = useRef(workspace.agentRunning);

  useEffect(() => {
    agentRunningRef.current = workspace.agentRunning;
  }, [workspace.agentRunning]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
      theme: LIGHT_TERMINAL_THEME,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    const safeFit = (): void => {
      try {
        fitAddon.fit();
      } catch {
        // The container has no size yet (Code tab hidden).
      }
    };
    safeFit();

    const handle = attachTerminal({
      cols: term.cols,
      rows: term.rows,
      onOutput: (chunk) => term.write(chunk),
    });

    const dataSubscription = term.onData((data) => {
      if (agentRunningRef.current) return;
      handle.write(data);
    });

    const observer = new ResizeObserver(() => {
      safeFit();
      handle.resize(term.cols, term.rows);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      dataSubscription.dispose();
      handle.dispose();
      term.dispose();
    };
  }, [attachTerminal]);

  return (
    <div className="relative h-full min-h-0 bg-white">
      <div ref={containerRef} className="h-full min-h-0 w-full p-1" />
      {workspace.agentRunning ? (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center bg-white/60 text-xs">
          Terminal paused while the agent is running…
        </div>
      ) : null}
    </div>
  );
}
