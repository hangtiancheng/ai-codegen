import type { ReactNode } from "react";

export function GlobalFooter(): ReactNode {
  return (
    <footer className="mt-10 py-5 text-center">
      <p className="text-muted-foreground m-0 text-sm">
        <a
          href="https://github.com/161043261"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary no-underline transition-colors"
        >
          {"\u00A9 "}
          {new Date().getFullYear()} AI Codegen. All rights reserved.
        </a>
      </p>
    </footer>
  );
}
