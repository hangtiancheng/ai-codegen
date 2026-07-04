import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

export default {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal(config) {
    return mergeConfig(config, {
      build: {
        chunkSizeWarningLimit: 1200,
      },
    });
  },
} satisfies StorybookConfig;
