import { beforeEach, describe, expect, it, vi } from "vitest";

const { initialize, render } = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn()
}));

vi.mock("mermaid", () => ({
  default: { initialize, render }
}));

import { renderMermaidBlocks } from "../../src/render/mermaid";

function rootWith(...sources: string[]): HTMLElement {
  const root = document.createElement("section");
  for (const source of sources) {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-mermaid";
    code.textContent = source;
    pre.append(code);
    root.append(pre);
  }
  document.body.append(root);
  return root;
}

describe("renderMermaidBlocks", () => {
  beforeEach(() => {
    render.mockReset();
    render.mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>흐름도</title><path d="M0 0L10 10" /></svg>'
    });
  });

  it("renders a Mermaid block as an accessible figure with safe global settings", async () => {
    const root = rootWith("graph TD; A-->B");

    await renderMermaidBlocks(root, "message-1");

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        deterministicIds: true,
        maxTextSize: 50_000,
        maxEdges: 500
      })
    );
    expect(root.querySelector("pre")).toBeNull();
    const figure = root.querySelector("figure.mermaid-diagram");
    expect(figure).not.toBeNull();
    expect(figure?.getAttribute("aria-label")).toContain("Mermaid");
    expect(figure?.querySelector("svg")?.getAttribute("role")).toBe("img");
  });

  it("preserves invalid source in an expandable Korean error disclosure", async () => {
    const source = "graph TD; A--";
    const root = rootWith(source);
    render.mockRejectedValueOnce(new Error("parse failed"));

    await renderMermaidBlocks(root, "message-invalid");

    const details = root.querySelector("details.mermaid-error");
    expect(details).not.toBeNull();
    expect(details?.querySelector("summary")?.textContent).toMatch(/[가-힣]/);
    expect(details?.querySelector("code.language-mermaid")?.textContent).toBe(source);
  });

  it("uses isolated deterministic render IDs for two blocks", async () => {
    const root = rootWith("graph TD; A-->B", "graph LR; C-->D");

    await renderMermaidBlocks(root, "same-preview");

    const firstId = render.mock.calls[0]?.[0];
    const secondId = render.mock.calls[1]?.[0];
    expect(firstId).toMatch(/^mermaid-[a-z0-9]+-0$/);
    expect(secondId).toMatch(/^mermaid-[a-z0-9]+-1$/);
    expect(firstId).not.toBe(secondId);
    expect(root.querySelectorAll("figure.mermaid-diagram")).toHaveLength(2);
  });

  it("removes executable attributes and external URLs from hostile SVG", async () => {
    const root = rootWith("graph TD; A-->B");
    render.mockResolvedValueOnce({
      svg: `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
        <script>alert(1)</script>
        <a href="https://attacker.invalid/steal" onclick="alert(1)"><text>bad</text></a>
        <image href="javascript:alert(1)" />
        <rect fill="url(https://attacker.invalid/pixel)" style="background:url(https://attacker.invalid/pixel)" />
        <style>@import url(https://attacker.invalid/css); .safe { fill: red; }</style>
      </svg>`
    });

    await renderMermaidBlocks(root, "hostile-preview");

    const svg = root.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.querySelector("script")).toBeNull();
    expect(svg?.querySelector("[onload], [onclick]")).toBeNull();
    expect(svg?.innerHTML).not.toMatch(/javascript:|attacker\.invalid/i);
    expect(svg?.querySelector("a")).toBeNull();
  });

  it("rejects escaped and comment-obfuscated CSS network loads", async () => {
    const root = rootWith("graph TD; A-->B");
    render.mockResolvedValueOnce({
      svg: `<svg xmlns="http://www.w3.org/2000/svg">
        <rect id="safe" fill="url(#safe)" />
        <rect id="escaped" style="fill:u\\72l('https://attacker.invalid/escaped')" />
        <rect id="commented" style="fill:u/**/rl(https://attacker.invalid/commented)" />
        <style>@\\69mport url(https://attacker.invalid/css); .bad { fill: red; }</style>
      </svg>`
    });

    await renderMermaidBlocks(root, "obfuscated-css");

    const svg = root.querySelector("svg");
    expect(svg?.querySelector("#safe")?.getAttribute("fill")).toBe("url(#safe)");
    expect(svg?.querySelector("#escaped")?.hasAttribute("style")).toBe(false);
    expect(svg?.querySelector("#commented")?.hasAttribute("style")).toBe(false);
    expect(svg?.querySelector("style")).toBeNull();
    expect(svg?.innerHTML).not.toContain("attacker.invalid");
  });

  it("removes image-set resources and all SVG style elements", async () => {
    const root = rootWith("graph TD; A-->B");
    render.mockResolvedValueOnce({
      svg: `<svg xmlns="http://www.w3.org/2000/svg">
        <rect id="image-set" style="background-image:image-set('https://attacker.invalid/pixel' 1x);fill:red" />
        <rect id="safe-style" style="fill:#fff;stroke:#333;stroke-width:2" />
        <style>.node { fill: red; }</style>
      </svg>`
    });

    await renderMermaidBlocks(root, "image-set-css");

    const svg = root.querySelector("svg");
    expect(svg?.querySelector("#image-set")?.hasAttribute("style")).toBe(false);
    expect(svg?.querySelector("#safe-style")?.getAttribute("style")).toBe("fill:#fff;stroke:#333;stroke-width:2");
    expect(svg?.querySelector("style")).toBeNull();
    expect(svg?.innerHTML).not.toContain("attacker.invalid");
  });

  it("does not pass Mermaid configuration directives to the renderer", async () => {
    const source = "%%{init: {'themeCSS': '@import url(https://attacker.invalid/css)'}}%%\ngraph TD; A-->B";
    const root = rootWith(source);

    await renderMermaidBlocks(root, "config-directive");

    expect(render).not.toHaveBeenCalled();
    expect(root.querySelector("details.mermaid-error code")?.textContent).toBe(source);
  });
});
