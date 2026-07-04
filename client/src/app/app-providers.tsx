import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthBoundary, AuthHydrationGate } from "@/shared/auth";
import { reportRuntimeIssue } from "@/shared/observability";
import { queryClient } from "@/shared/query";
import { ErrorBoundary, PageLoader, RootErrorFallback } from "@/shared/ui";

type AppProvidersProps = {
  readonly children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps): ReactNode {
  return (
    <ErrorBoundary
      fallback={(error) => <RootErrorFallback error={error} />}
      onError={(error) =>
        reportRuntimeIssue({
          kind: "root-error",
          message: error.message,
          cause: error,
        })
      }
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthBoundary>
            <AuthHydrationGate fallback={<PageLoader />}>
              {children}
            </AuthHydrationGate>
          </AuthBoundary>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
