import { createRoot } from "react-dom/client";
import { AppProviders, AppRoot } from "@/app";
import "./index.css";
import {
  ReactErrorBoundary,
  type ReactErrorBoundaryProps,
} from "@swifty.js/sentry/react";
import { init, enablePlugin } from "@swifty.js/sentry";
import {
  PerformancePlugin,
  ScreenRecordPlugin,
  ExposurePlugin,
} from "@swifty.js/sentry/plugins";
import type { ErrorInfo } from "react";

if (!import.meta.env.DEV) {
  init({ dsn: "/sentry", visitorId: "" });
  enablePlugin(new PerformancePlugin());
  enablePlugin(new ScreenRecordPlugin());
  enablePlugin(new ExposurePlugin());
}

const rootElement = document.getElementById("root");

const props: ReactErrorBoundaryProps = {
  fallback: (err: Error, errInfo: ErrorInfo | undefined) => {
    console.error(err, errInfo);
    return <div>Error: {err.message}</div>;
  },
};

if (rootElement) {
  createRoot(rootElement).render(
    <ReactErrorBoundary {...props}>
      <AppProviders>
        <AppRoot />
      </AppProviders>
    </ReactErrorBoundary>,
  );
}
