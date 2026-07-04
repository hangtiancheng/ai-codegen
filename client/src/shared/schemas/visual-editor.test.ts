import { describe, expect, it } from "vitest";
import { visualEditorIncomingMessageSchema } from "./visual-editor";

describe("visualEditorIncomingMessageSchema", () => {
  const elementInfo = {
    tagName: "DIV",
    id: "main",
    className: "card",
    textContent: "Hello",
    selector: "#main",
    pagePath: "/index.html",
    rect: { top: 0, left: 0, width: 100, height: 50 },
  };

  it("accepts ELEMENT_SELECTED", () => {
    const value = visualEditorIncomingMessageSchema.parse({
      type: "ELEMENT_SELECTED",
      elementInfo,
    });
    expect(value.type).toBe("ELEMENT_SELECTED");
  });

  it("accepts EDIT_MODE_TOGGLED", () => {
    const value = visualEditorIncomingMessageSchema.parse({
      type: "EDIT_MODE_TOGGLED",
      editMode: true,
    });
    expect(value.type).toBe("EDIT_MODE_TOGGLED");
  });

  it("rejects unknown type", () => {
    const result = visualEditorIncomingMessageSchema.safeParse({
      type: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative rect width", () => {
    const result = visualEditorIncomingMessageSchema.safeParse({
      type: "ELEMENT_SELECTED",
      elementInfo: {
        ...elementInfo,
        rect: { top: 0, left: 0, width: -1, height: 0 },
      },
    });
    expect(result.success).toBe(false);
  });
});
