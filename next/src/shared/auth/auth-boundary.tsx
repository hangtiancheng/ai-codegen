import { type ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { setUnauthorizedRedirectHandler } from "@/shared/api";
import { useUserStore } from "./user-store";

const loginPath = "/user/login";
const skipPaths = ["/user/login", "/user/register"];

export type AuthBoundaryProps = {
  readonly children: ReactNode;
};

export function AuthBoundary({ children }: AuthBoundaryProps): ReactNode {
  const navigate = useNavigate();
  const location = useLocation();
  const clear = useUserStore((state) => state.clear);

  useEffect(() => {
    setUnauthorizedRedirectHandler(() => {
      clear();
      const currentPath = location.pathname + location.search;
      if (skipPaths.includes(location.pathname)) {
        return;
      }
      const target = `${loginPath}?redirect=${encodeURIComponent(currentPath)}`;
      navigate(target, { replace: true });
    });
    return () => {
      setUnauthorizedRedirectHandler(() => undefined);
    };
  }, [navigate, location.pathname, location.search, clear]);

  return children;
}
