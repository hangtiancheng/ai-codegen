import { type ReactNode } from "react";
import { Button } from "@/shared/ui";
import type { NavLinkItem } from "./nav-links.config";

export type NavLinkProps = {
  readonly active: boolean;
  readonly item: NavLinkItem;
  readonly onNavigate: (href: string) => void;
};

export function NavLink({ active, item, onNavigate }: NavLinkProps): ReactNode {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate(item.href)}
    >
      {item.label}
    </Button>
  );
}
