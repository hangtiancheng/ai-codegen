import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sprout } from "lucide-react";
import { useUserStore } from "@/shared/auth";
import { useLogout } from "@/shared/query";
import { Button, UserInfo } from "@/shared/ui";
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
    <header className="border-border bg-background/80 sticky top-0 z-30 border-b px-4 py-2.5 backdrop-blur-sm md:px-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-foreground hover:text-primary flex items-center gap-2 text-lg font-semibold transition-colors"
        >
          <Sprout className="text-primary size-5" aria-hidden="true" />
          Swifty Codegen
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
              <span className="hidden sm:inline">
                <UserInfo user={user} showName size="sm" />
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => navigate("/user/login")}>
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
