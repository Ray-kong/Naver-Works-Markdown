import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../src/render/markdown";
import { sanitizeHtml } from "../../src/render/sanitize";

describe("Markdown safety boundary", () => {
  it("renders supported Markdown without raw HTML", () => {
    const html = renderMarkdown("# 제목\n\n- 하나\n- 둘\n\n`code`");

    expect(html).toContain("<h1>제목</h1>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<code>code</code>");
  });

  it("removes executable and unsupported HTML", () => {
    const sanitized = sanitizeHtml(
      '<script>alert(1)</script><img src=x onerror=alert(1)><p onclick=alert(1)>ok</p>'
    );

    expect(sanitized).not.toMatch(/script|img|onerror|onclick/i);
    expect(sanitized).toContain("<p>ok</p>");
  });

  it("rejects javascript URLs and hardens external links", () => {
    const hostile = renderMarkdown("[실행](javascript:alert(1))");
    expect(hostile).not.toMatch(/href=["']javascript:/i);

    const external = renderMarkdown("[문서](https://example.com)");
    expect(external).toContain('target="_blank"');
    expect(external).toContain('rel="noopener noreferrer"');
  });

  it("preserves only the exact Mermaid fence class", () => {
    expect(renderMarkdown("```mermaid\ngraph TD\nA-->B\n```")).toContain('class="language-mermaid"');
    expect(renderMarkdown("```mermaid extra\ngraph TD\nA-->B\n```")).not.toContain("language-mermaid");
    expect(sanitizeHtml('<p class="works-native"><code class="language-js extra">x</code></p>')).not.toContain("class=");
  });
});
