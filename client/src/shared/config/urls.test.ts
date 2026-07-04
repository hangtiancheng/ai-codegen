import { describe, expect, it } from "vitest";
import { appIdSchema } from "@/shared/schemas";
import { getDeployUrl, getStaticPreviewUrl } from "./urls";

describe("getDeployUrl", () => {
  it("points to the deployed index file", () => {
    expect(getDeployUrl("y43i5d")).toBe(
      "http://localhost:3000/api/dist/y43i5d/index.html",
    );
  });
});

describe("getStaticPreviewUrl", () => {
  it("uses the selected Vite project preview suffix", () => {
    expect(getStaticPreviewUrl("VITE_PROJECT", appIdSchema.parse(10))).toBe(
      "http://localhost:3000/api/static/vite_project_10/dist/",
    );
  });

  it("does not append a framework suffix for html apps", () => {
    expect(getStaticPreviewUrl("VANILLA_HTML", appIdSchema.parse(10))).toBe(
      "http://localhost:3000/api/static/vanilla_html_10/",
    );
  });
});
