export type QuickPrompt = {
  readonly label: string;
  readonly prompt: string;
};

export const quickPrompts: ReadonlyArray<QuickPrompt> = [
  {
    label: "Personal Blog",
    prompt: "Create a personal blog website with a clean article layout.",
  },
  {
    label: "Corporate Website",
    prompt: "Create a polished corporate website for a technology company.",
  },
  {
    label: "Online Store",
    prompt: "Create an online store with product cards and checkout sections.",
  },
  {
    label: "Portfolio Website",
    prompt: "Create a portfolio website for a product designer.",
  },
];
