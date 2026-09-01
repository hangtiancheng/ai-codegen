import { createRoot } from "react-dom/client";
import { AppProviders, AppRoot } from "@/app";
import { RootErrorFallback } from "@/shared/ui";
import "./index.css";
import { ReactErrorBoundary } from "@swifty.js/sentry/react";
import { init, enablePlugin } from "@swifty.js/sentry";
import {
  PerformancePlugin,
  ScreenRecordPlugin,
  ExposurePlugin,
} from "@swifty.js/sentry/plugins";

// dev: "/sentry" is mocked by the @swifty.js/sentry vite plugin; prod: placeholder until a real endpoint exists
const sentryDsn = import.meta.env.DEV ? "/sentry" : "/path/to/server/dsn";

init({
  dsn: sentryDsn,
  projectId: "swifty-codegen",
  debug: import.meta.env.DEV,
  // prod placeholder: capture events but drop them until a real collector endpoint is wired up
  beforeSend: (data) => (import.meta.env.PROD ? false : data),
});
enablePlugin(
  new PerformancePlugin(),
  new ScreenRecordPlugin(),
  new ExposurePlugin(),
);

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <ReactErrorBoundary
      fallback={(error) => <RootErrorFallback error={error} />}
    >
      <AppProviders>
        <AppRoot />
      </AppProviders>
    </ReactErrorBoundary>,
  );
}
