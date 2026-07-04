import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarkdownRenderer } from "./markdown-renderer";

const meta = {
  title: "Design System/Markdown Renderer",
  component: MarkdownRenderer,
  args: {
    content: [
      "# Generated Plan",
      "",
      "This renderer supports **Markdown** while sanitizing unsafe HTML.",
      "",
      "- Safe links",
      "- Tables",
      "- Code blocks",
      "",
      "```ts",
      'const message = "hello";',
      "```",
    ].join("\n"),
  },
} satisfies Meta<typeof MarkdownRenderer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
