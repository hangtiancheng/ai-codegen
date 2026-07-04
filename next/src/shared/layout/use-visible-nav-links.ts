import { selectIsAdmin, useUserStore } from "@/shared/auth";
import { type NavLinkItem, navLinks } from "./nav-links.config";

export function useVisibleNavLinks(): ReadonlyArray<NavLinkItem> {
  const isAdmin = useUserStore(selectIsAdmin);
  return navLinks.filter((item) => !item.adminOnly || isAdmin);
}
