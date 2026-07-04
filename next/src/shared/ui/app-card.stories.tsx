import type { Meta, StoryObj } from "@storybook/react-vite";
import { appVoSchema } from "@/shared/schemas";
import { AppCard } from "./app-card";

const sampleApp = appVoSchema.parse({
  id: 1,
  appName: "Marketing Launchpad",
  initPrompt: "Build a launch page for a productivity app",
  codegenType: "VANILLA_HTML",
  deployKey: "launchpad",
  createTime: "2025-01-01T08:00:00.000Z",
  userId: 2,
  user: {
    id: 2,
    userAccount: "creator@example.com",
    username: "Creator",
    userRole: "user",
  },
});

const meta = {
  title: "Design System/App Card",
  component: AppCard,
  args: {
    app: sampleApp,
    featured: true,
  },
} satisfies Meta<typeof AppCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Featured: Story = {};

export const Standard: Story = {
  args: {
    featured: false,
  },
};
