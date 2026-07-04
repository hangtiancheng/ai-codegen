import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useUserStore } from "@/shared/auth";
import { useLogout } from "@/shared/query";
import { NavLink } from "./nav-links";
import { useVisibleNavLinks } from "./use-visible-nav-links";

export function GlobalHeader(): ReactNode {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const clear = useUserStore((state) => state.clear);
  const items = useVisibleNavLinks();
  const logoutMutation = useLogout();

  const handleLogout = (): void => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clear();
        toast.success("Logged out");
        navigate("/user/login", { replace: true });
      },
      onError: () => {
        toast.error("Logout failed");
      },
    });
  };

  return (
    <header className="border-border bg-background border-b px-4 py-3 md:px-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-foreground flex items-center gap-3 text-xl font-medium"
        >
          AI App Generator
        </button>
        <nav className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              active={location.pathname === item.href}
              onNavigate={(href) => navigate(href)}
            />
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-foreground/80 hidden text-sm sm:inline">
                {user.username ?? user.userAccount}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
              >
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/user/login")}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-sm font-medium"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
