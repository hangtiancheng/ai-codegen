import { describe, expect, it } from "vitest";
import { CodegenType } from "../generated/prisma/enums.js";
import { parseGeneratedCode } from "./code-parser.js";

describe("code parser", () => {
  it("parses vanilla HTML from a fenced html block", () => {
    const parsed = parseGeneratedCode(
      "Here is code:\n```html\n<div>Hello</div>\n```",
      CodegenType.VANILLA_HTML,
    );

    expect(parsed.files).toEqual([{ content: "<div>Hello</div>", filename: "index.html" }]);
  });

  it("uses raw content for vanilla HTML when no code fence exists", () => {
    const parsed = parseGeneratedCode("<main>Raw</main>", CodegenType.VANILLA_HTML);

    expect(parsed.files[0]).toEqual({
      content: "<main>Raw</main>",
      filename: "index.html",
    });
  });

  it("parses multi-file output into html, css, and js files", () => {
    const parsed = parseGeneratedCode(
      "```html\n<div id=\"app\"></div>\n```\n```css\nbody{margin:0}\n```\n```js\nconsole.log('ok')\n```",
      CodegenType.MULTI_FILES,
    );

    expect(parsed.files).toEqual([
      { content: '<div id="app"></div>', filename: "index.html" },
      { content: "body{margin:0}", filename: "index.css" },
      { content: "console.log('ok')", filename: "index.js" },
    ]);
  });

  it("rejects malformed multi-file output without html", () => {
    expect(() => parseGeneratedCode("```css\nbody{}\n```", CodegenType.MULTI_FILES)).toThrow(
      "HTML code block is required",
    );
  });

  it("rejects empty generated content", () => {
    expect(() => parseGeneratedCode("   ", CodegenType.VANILLA_HTML)).toThrow(
      "Generated content cannot be empty",
    );
  });

  it("parses Vite project files from FileWrite JSON blocks", () => {
    const parsed = parseGeneratedCode(
      '```json\n{"filepath":"package.json","content":"{\\"scripts\\":{}}"}\n```\n```json\n{"filepath":"src/App.jsx","content":"export default function App(){}"}\n```',
      CodegenType.VITE_PROJECT,
    );

    expect(parsed.files).toEqual([
      { content: '{"scripts":{}}', filename: "package.json" },
      { content: "export default function App(){}", filename: "src/App.jsx" },
    ]);
  });

  it("parses Vite project files from filename metadata", () => {
    const parsed = parseGeneratedCode(
      "```jsx filename=src/App.jsx\nexport default function App(){}\n```",
      CodegenType.VITE_PROJECT,
    );

    expect(parsed.files).toEqual([
      { content: "export default function App(){}", filename: "src/App.jsx" },
    ]);
  });

  it("parses Vite JSON files from filename metadata", () => {
    const parsed = parseGeneratedCode(
      '```json filename=tsconfig.json\n{"include":["src"]}\n```',
      CodegenType.VITE_PROJECT,
    );

    expect(parsed.files).toEqual([{ content: '{"include":["src"]}', filename: "tsconfig.json" }]);
  });

  it("rejects malformed Vite JSON file blocks", () => {
    expect(() =>
      parseGeneratedCode(
        '```json\n{"filepath":"src/App.tsx","content":"import "./broken";"}\n```',
        CodegenType.VITE_PROJECT,
      ),
    ).toThrow("Invalid Vite project JSON file block");
  });

  it("rejects unsupported FileWrite pseudo-code output", () => {
    expect(() =>
      parseGeneratedCode(
        '```tsx\nimport { FileWrite } from "assistant-file-write";\nconst files = [{ filepath: "./package.json", content: "{}" }];\n```\n',
        CodegenType.VITE_PROJECT,
      ),
    ).toThrow("Unsupported Vite project FileWrite pseudo-code output");
  });
});
