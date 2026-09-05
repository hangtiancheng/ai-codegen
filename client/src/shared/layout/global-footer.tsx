import { CodeXml, Sprout } from "lucide-react";
import { type ReactNode } from "react";

export function GlobalFooter(): ReactNode {
  return (
    <footer className="border-border mt-auto border-t py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 md:flex-row md:px-6">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Sprout className="text-primary size-4" aria-hidden="true" />
          <span>Swifty Codegen</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/hangtiancheng/swifty-codegen"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <CodeXml className="size-4" aria-hidden="true" />
            GitHub
          </a>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Swifty Codegen
          </p>
        </div>
      </div>
    </footer>
  );
}
