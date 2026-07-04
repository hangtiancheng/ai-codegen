import type { Meta, StoryObj } from "@storybook/react-vite";
import { userVoSchema } from "@/shared/schemas";
import { Badge } from "./badge";
import { Button } from "./button";
import { UserInfo } from "./user-info";

const sampleUser = userVoSchema.parse({
  id: 2,
  userAccount: "designer@example.com",
  username: "Designer",
  userRole: "admin",
});

function Foundation(): React.ReactNode {
  return (
    <div className="border-border bg-card grid max-w-2xl gap-6 rounded-2xl border p-6">
      <section className="flex flex-wrap gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="danger">Danger</Button>
      </section>
      <section className="flex flex-wrap gap-2">
        <Badge variant="blue">Admin</Badge>
        <Badge variant="success">Deployed</Badge>
        <Badge variant="warning">Pending</Badge>
      </section>
      <UserInfo user={sampleUser} />
    </div>
  );
}

const meta = {
  title: "Design System/Foundation",
  component: Foundation,
} satisfies Meta<typeof Foundation>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
