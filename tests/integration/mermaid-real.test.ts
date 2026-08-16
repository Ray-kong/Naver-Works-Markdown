import { describe, expect, it } from "vitest";
import { renderMermaidBlocks } from "../../src/render/mermaid";

describe("real Mermaid rendering", () => {
  it("renders the four supported diagram families as sanitized SVG", async () => {
    Object.defineProperty(SVGElement.prototype, "getBBox", {
      configurable: true,
      value: () => ({ x: 0, y: 0, width: 100, height: 20 })
    });
    Object.defineProperty(SVGElement.prototype, "getComputedTextLength", {
      configurable: true,
      value: () => 80
    });
    const root = document.createElement("section");
    const sources = [
      "flowchart TD\nA-->B",
      "sequenceDiagram\nA->>B: Hello",
      "classDiagram\nclass Animal",
      "stateDiagram-v2\n[*] --> Ready"
    ];
    for (const source of sources) {
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.className = "language-mermaid";
      code.textContent = source;
      pre.append(code);
      root.append(pre);
    }
    document.body.append(root);

    const started = performance.now();
    await renderMermaidBlocks(root, "real-four-families");

    expect(root.querySelectorAll("figure.mermaid-diagram svg")).toHaveLength(4);
    expect(root.querySelector("details.mermaid-error")).toBeNull();
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
