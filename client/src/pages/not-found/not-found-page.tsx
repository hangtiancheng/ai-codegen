import { Home, Sprout } from "lucide-react";
import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui";

export function NotFoundPage(): ReactNode {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center">
      <span className="border-primary/20 bg-primary/5 text-primary mb-6 inline-flex size-16 items-center justify-center rounded-full border shadow-sm">
        <Sprout className="size-8" aria-hidden="true" />
      </span>
      <p className="text-primary text-sm font-semibold tracking-wide">404</p>
      <h1 className="text-foreground mt-2 text-3xl font-semibold tracking-tight">
        This page wandered off
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm">
        The page you are looking for does not exist or has been moved. Let us
        take you back to familiar ground.
      </p>
      <Button className="mt-8" onClick={() => navigate("/")}>
        <Home data-icon="inline-start" aria-hidden="true" />
        Back to home
      </Button>
    </div>
  );
}
