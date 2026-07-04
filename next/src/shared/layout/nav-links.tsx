import type { ReactNode } from "react";
import type { NavLinkItem } from "./nav-links.config";

export type NavLinkProps = {
  readonly active: boolean;
  readonly item: NavLinkItem;
  readonly onNavigate: (href: string) => void;
};

export function NavLink({ active, item, onNavigate }: NavLinkProps): ReactNode {
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.href)}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-foreground/70 hover:bg-secondary/60 hover:text-foreground"
      }`}
    >
      {item.label}
    </button>
  );
}
