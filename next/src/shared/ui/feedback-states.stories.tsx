import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { LoadingState } from "./loading-state";

function FeedbackStates(): React.ReactNode {
  return (
    <div className="grid max-w-3xl gap-6">
      <EmptyState
        title="No apps yet"
        description="Start by describing the app you want to generate."
        action={<Button>Create app</Button>}
      />
      <LoadingState label="Loading generated apps" />
      <ErrorState
        title="Could not load apps"
        description="The API returned a temporary error. Retry the request."
        action={<Button variant="outline">Retry</Button>}
      />
    </div>
  );
}

const meta = {
  title: "Design System/Feedback States",
  component: FeedbackStates,
} satisfies Meta<typeof FeedbackStates>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
