import type { Meta, StoryObj } from "@storybook/react-vite";
import { appVoSchema } from "@/shared/schemas";
import { AppDetailModal } from "./app-detail-modal";
import { DeploySuccessModal } from "./deploy-success-modal";

const sampleApp = appVoSchema.parse({
  id: 1,
  appName: "Portfolio Builder",
  initPrompt: "Build a portfolio site",
  codegenType: "MULTI_FILES",
  deployKey: "portfolio",
  createTime: "2025-01-01T08:00:00.000Z",
  userId: 2,
  user: {
    id: 2,
    userAccount: "owner@example.com",
    username: "Owner",
    userRole: "user",
  },
});

function ModalGallery(): React.ReactNode {
  return (
    <div className="min-h-96">
      <AppDetailModal
        open
        app={sampleApp}
        showActions
        onOpenChange={() => undefined}
      />
      <DeploySuccessModal
        open={false}
        deployUrl="https://preview.example.com/app/portfolio"
        onOpenChange={() => undefined}
      />
    </div>
  );
}

const meta = {
  title: "Design System/Modals",
  component: ModalGallery,
} satisfies Meta<typeof ModalGallery>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AppDetails: Story = {};
