import { describe, expect, it } from "vitest";
import { visualEditorElementInfoSchema } from "@/shared/schemas";
import { appendSelectedElementContext } from "./selected-element-context";

describe("appendSelectedElementContext", () => {
  it("adds typed selected element details to a prompt", () => {
    const element = visualEditorElementInfoSchema.parse({
      tagName: "BUTTON",
      id: "save",
      className: "primary",
      textContent: "Save changes",
      selector: "button#save",
      pagePath: "/settings",
      rect: { top: 1, left: 2, width: 100, height: 40 },
    });

    const result = appendSelectedElementContext("Make it larger", element);

    expect(result).toContain("Make it larger");
    expect(result).toContain("- Page path: /settings");
    expect(result).toContain("- Tag: button");
    expect(result).toContain("- Selector: button#save");
    expect(result).toContain("- Current content: Save changes");
  });
});
