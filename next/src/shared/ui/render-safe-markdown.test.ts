import { describe, expect, it } from "vitest";
import { renderSafeMarkdown } from "./render-safe-markdown";

describe("renderSafeMarkdown", () => {
  it("renders markdown content to sanitized HTML", () => {
    const html = renderSafeMarkdown("# Title\n\n<script>alert(1)</script>");

    expect(html).toContain("<h1>Title</h1>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert(1)");
  });

  it("removes unsafe link attributes", () => {
    const html = renderSafeMarkdown(
      '[Unsafe](javascript:alert(1))\n\n<a onclick="alert(1)">bad</a>',
    );

    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onclick");
  });

  it("adds safe code highlighting for known fenced languages", () => {
    const html = renderSafeMarkdown("```ts\nexport const value = 1;\n```");

    expect(html).toContain('data-language="ts"');
    expect(html).toContain('<span class="token keyword">export</span>');
    expect(html).toContain('<span class="token keyword">const</span>');
  });

  it("recognizes fenced code language aliases", () => {
    const html = renderSafeMarkdown("```python\ndef build_app():\n  return 1\n```");

    expect(html).toContain('data-language="python"');
    expect(html).toContain('<span class="token keyword">def</span>');
    expect(html).toContain('<span class="token keyword">return</span>');
  });

  it("recognizes the javascript language name", () => {
    const html = renderSafeMarkdown(
      "```javascript\nexport function buildApp() {\n  return true;\n}\n```",
    );

    expect(html).toContain('data-language="javascript"');
    expect(html).toContain('<span class="token keyword">function</span>');
  });

  it("escapes unknown code fences without highlighting tokens", () => {
    const html = renderSafeMarkdown("```custom\n<script>alert(1)</script>\n```");

    expect(html).toContain('data-language="text"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("token keyword");
  });

  it("preserves sanitized markdown tables", () => {
    const html = renderSafeMarkdown("| Name | Status |\n| --- | --- |\n| v2 | Ready |");

    expect(html).toContain("<table>");
    expect(html).toContain("<th>Name</th>");
    expect(html).toContain("<td>Ready</td>");
  });
});
