import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "@/shared/ui";

export function NotFoundPage(): ReactNode {
  return (
    <PageContainer title="Page Not Found">
      <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <p className="text-muted-foreground text-sm">The requested page does not exist.</p>
        <Link to="/" className="text-primary mt-4 inline-flex text-sm font-medium hover:underline">
          Back to home
        </Link>
      </section>
    </PageContainer>
  );
}
