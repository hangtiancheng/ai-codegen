import type { Meta, StoryObj } from "@storybook/react-vite";
import { appVoSchema, chatHistorySchema, userVoSchema } from "@/shared/schemas";
import { AdminAppTable } from "../admin-app-manage/admin-app-table";
import { AdminChatTable } from "../admin-chat-manage/admin-chat-table";
import { AdminUserTable } from "../admin-user-manage/admin-user-table";

const user = userVoSchema.parse({
  id: 2,
  userAccount: "member@example.com",
  username: "Member",
  userProfile: "Builds internal tools",
  userRole: "user",
  createTime: "2026-05-18T10:00:00Z",
});

const admin = userVoSchema.parse({
  id: 1,
  userAccount: "admin@example.com",
  username: "Admin",
  userRole: "admin",
  createTime: "2026-05-18T09:00:00Z",
});

const app = appVoSchema.parse({
  id: 10,
  appName: "Admin Dashboard",
  initPrompt: "Build an operational dashboard for generated apps",
  codegenType: "VANILLA_HTML",
  priority: 99,
  deployKey: "admin-dashboard",
  userId: 2,
  user,
  createTime: "2026-05-18T10:00:00Z",
});

const chat = chatHistorySchema.parse({
  id: 20,
  appId: 10,
  userId: 2,
  message: "Generate a dashboard with search, tables, and charts.",
  messageType: "user",
  createTime: "2026-05-18T10:30:00Z",
});

function AdminTablesShowcase(): React.ReactNode {
  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Users</h2>
        <AdminUserTable users={[admin, user]} deletingId={undefined} onDelete={() => undefined} />
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Apps</h2>
        <AdminAppTable
          apps={[app]}
          busyAppId={undefined}
          onEdit={() => undefined}
          onToggleAwesome={() => undefined}
          onDelete={() => undefined}
        />
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Chat History</h2>
        <AdminChatTable messages={[chat]} onViewChat={() => undefined} />
      </section>
    </div>
  );
}

const meta = {
  title: "Features/Admin Tables",
  component: AdminTablesShowcase,
} satisfies Meta<typeof AdminTablesShowcase>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
