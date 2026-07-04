import { type ImageResource, imageResourceListSchema } from "./image-assets.schema.js";

const categoryLabel = (category: ImageResource["category"]): string => {
  switch (category) {
    case "ARCHITECTURE":
      return "Architecture diagram";
    case "CONTENT":
      return "Content image";
    case "ILLUSTRATION":
      return "Illustration";
    case "LOGO":
      return "Logo";
  }
};

export const appendImageResourcesToPrompt = (
  prompt: string,
  resources: readonly ImageResource[],
): string => {
  const parsedResources = imageResourceListSchema.parse(resources);
  if (parsedResources.length === 0) {
    return prompt;
  }
  const lines = parsedResources.map(
    (resource) =>
      `- ${categoryLabel(resource.category)}: ${resource.description} (${resource.url})`,
  );
  return `${prompt}\n\n## Available Visual Assets\nUse these visual assets where they fit the generated website:\n${lines.join("\n")}`;
};
