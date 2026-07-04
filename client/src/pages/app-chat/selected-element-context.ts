import { type VisualEditorElementInfo } from "@/shared/schemas";

export function appendSelectedElementContext(
  message: string,
  element: VisualEditorElementInfo | undefined,
): string {
  if (element === undefined) {
    return message;
  }
  const lines = [
    message,
    "",
    "Selected element context:",
    element.pagePath ? `- Page path: ${element.pagePath}` : undefined,
    `- Tag: ${element.tagName.toLowerCase()}`,
    `- Selector: ${element.selector}`,
    element.textContent
      ? `- Current content: ${element.textContent}`
      : undefined,
  ].filter((value): value is string => value !== undefined);
  return lines.join("\n");
}
