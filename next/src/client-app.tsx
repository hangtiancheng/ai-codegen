"use client";

import type { ReactNode } from "react";
import { AppProviders, AppRoot } from "@/app";

export function ClientApp(): ReactNode {
  return (
    <AppProviders>
      <AppRoot />
    </AppProviders>
  );
}
