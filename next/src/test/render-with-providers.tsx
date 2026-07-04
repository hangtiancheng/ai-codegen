import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, type RenderResult, render } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

type RenderWithProvidersOptions = Omit<RenderOptions, "wrapper"> & {
  readonly initialEntries?: ReadonlyArray<string>;
  readonly queryClient?: QueryClient;
};

type RenderWithProvidersResult = RenderResult & {
  readonly user: UserEvent;
  readonly queryClient: QueryClient;
};

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const initialEntries = options.initialEntries ?? ["/"];

  function Wrapper({ children }: { readonly children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[...initialEntries]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  const result = render(ui, { ...options, wrapper: Wrapper });
  return {
    ...result,
    user: userEvent.setup(),
    queryClient,
  };
}
