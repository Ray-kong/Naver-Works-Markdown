import DOMPurify from "dompurify";
import mermaid from "mermaid";

import {
  MERMAID_MAX_EDGES as maxEdges,
  MERMAID_MAX_TEXT_SIZE as maxTextSize
} from "../shared/limits";

const SVG_TAGS = [
  "circle",
  "clipPath",
  "defs",
  "desc",
  "ellipse",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feMerge",
  "feMergeNode",
  "feOffset",
  "filter",
  "g",
  "line",
  "linearGradient",
  "marker",
  "mask",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "stop",
  "svg",
  "text",
  "textPath",
  "title",
  "tspan",
  "use"
] as const;

const SVG_ATTRIBUTES = [
  "alignment-baseline",
  "aria-describedby",
  "aria-hidden",
  "aria-label",
  "aria-labelledby",
  "class",
  "clip-path",
  "cx",
  "cy",
  "d",
  "dominant-baseline",
  "dx",
  "dy",
  "fill",
  "fill-opacity",
  "filter",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "height",
  "href",
  "id",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "offset",
  "opacity",
  "orient",
  "points",
  "preserveAspectRatio",
  "r",
  "refX",
  "refY",
  "role",
  "rx",
  "ry",
  "spreadMethod",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "style",
  "tabindex",
  "text-anchor",
  "transform",
  "viewBox",
  "width",
  "x",
  "x1",
  "x2",
  "xlink:href",
  "xmlns",
  "xmlns:xlink",
  "y",
  "y1",
  "y2"
] as const;

const URL_ATTRIBUTES = new Set(["href", "xlink:href", "src"]);
const MERMAID_CONFIG_DIRECTIVE = /%%\s*\{/;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const CSS_HEX_ESCAPE = /\\([0-9a-f]{1,6})\s?/gi;
const CSS_SIMPLE_ESCAPE = /\\([^\r\n\f])/g;
const CSS_URL = /url\s*\(\s*([^)]*?)\s*\)/gi;
const UNSAFE_RESOURCE_VALUE = /(?:https?:|data:|javascript:|blob:|file:|(?:^|[^:])\/\/|(?:-webkit-)?image-set\s*\()/i;
const SAFE_STYLE_PROPERTIES = new Set([
  "alignment-baseline",
  "color",
  "dominant-baseline",
  "fill",
  "fill-opacity",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "marker-end",
  "marker-mid",
  "marker-start",
  "opacity",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "text-align",
  "text-anchor"
]);

let initialized = false;

function initializeMermaid(): void {
  if (initialized) return;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    suppressErrorRendering: true,
    htmlLabels: false,
    deterministicIds: true,
    deterministicIDSeed: "works-markdown-preview",
    maxTextSize,
    maxEdges,
    secure: [
      "startOnLoad",
      "securityLevel",
      "suppressErrorRendering",
      "deterministicIds",
      "deterministicIDSeed",
      "maxTextSize",
      "maxEdges",
      "htmlLabels",
      "theme",
      "themeCSS",
      "themeVariables",
      "fontFamily",
      "secure"
    ]
  });
  initialized = true;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function normalizeCssForInspection(value: string): string {
  return value
    .replace(CSS_COMMENT, "")
    .replace(CSS_HEX_ESCAPE, (_match, digits: string) => {
      const codePoint = Number.parseInt(digits, 16);
      return codePoint === 0 || codePoint > 0x10ffff ? "\uFFFD" : String.fromCodePoint(codePoint);
    })
    .replace(CSS_SIMPLE_ESCAPE, "$1");
}

function hasUnsafeCss(value: string): boolean {
  const normalized = normalizeCssForInspection(value);
  if (
    UNSAFE_RESOURCE_VALUE.test(normalized) ||
    /@import\b|expression\s*\(|(?:^|[;{])\s*behavior\s*:|-moz-binding\s*:/i.test(normalized)
  ) {
    return true;
  }

  for (const match of normalized.matchAll(CSS_URL)) {
    const target = (match[1] ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
    if (!/^#[A-Za-z_][\w:.-]*$/.test(target)) return true;
  }
  return false;
}

function sanitizeStyleAttribute(value: string): string | undefined {
  const normalized = normalizeCssForInspection(value);
  if (hasUnsafeCss(normalized) || /[{}@]/.test(normalized)) return undefined;

  const declarations: string[] = [];
  for (const rawDeclaration of normalized.split(";")) {
    const declaration = rawDeclaration.trim();
    if (!declaration) continue;
    const colon = declaration.indexOf(":");
    if (colon <= 0) return undefined;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const propertyValue = declaration.slice(colon + 1).trim();
    if (!SAFE_STYLE_PROPERTIES.has(property) || !propertyValue || UNSAFE_RESOURCE_VALUE.test(propertyValue)) {
      return undefined;
    }
    declarations.push(`${property}:${propertyValue}`);
  }
  return declarations.length > 0 ? declarations.join(";") : undefined;
}

function sanitizeSvg(svg: string): SVGSVGElement {
  const sanitized = DOMPurify.sanitize(svg, {
    ALLOWED_TAGS: [...SVG_TAGS],
    ALLOWED_ATTR: [...SVG_ATTRIBUTES]
  });
  const parsed = new DOMParser().parseFromString(sanitized, "image/svg+xml");
  const root = parsed.documentElement;

  if (root.localName !== "svg" || parsed.querySelector("parsererror")) {
    throw new Error("Mermaid did not return a valid SVG document.");
  }

  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
      } else if (URL_ATTRIBUTES.has(name) && !attribute.value.trim().startsWith("#")) {
        element.removeAttribute(attribute.name);
      } else if (name === "style") {
        const safeStyle = sanitizeStyleAttribute(attribute.value);
        if (safeStyle) element.setAttribute(attribute.name, safeStyle);
        else element.removeAttribute(attribute.name);
      } else if (hasUnsafeCss(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  return document.importNode(root, true) as unknown as SVGSVGElement;
}

function renderFailure(source: string): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "mermaid-error";

  const summary = document.createElement("summary");
  summary.textContent = "Mermaid 다이어그램을 렌더링하지 못했습니다.";

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = "language-mermaid";
  code.textContent = source;
  pre.append(code);
  details.append(summary, pre);
  return details;
}

function renderFigure(svg: SVGSVGElement, index: number): HTMLElement {
  const figure = document.createElement("figure");
  figure.className = "mermaid-diagram";
  figure.setAttribute("aria-label", `Mermaid 다이어그램 ${index + 1}`);
  svg.setAttribute("role", "img");
  if (!svg.hasAttribute("aria-label") && !svg.hasAttribute("aria-labelledby")) {
    svg.setAttribute("aria-label", `Mermaid 다이어그램 ${index + 1}`);
  }
  figure.append(svg);
  return figure;
}

export async function renderMermaidBlocks(root: ParentNode, previewKey: string): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>("code.language-mermaid")];
  if (blocks.length === 0) return;

  try {
    initializeMermaid();
  } catch {
    for (const code of blocks) {
      (code.closest("pre") ?? code).replaceWith(renderFailure(code.textContent ?? ""));
    }
    return;
  }
  const previewId = stableHash(previewKey);

  for (const [index, code] of blocks.entries()) {
    const source = code.textContent ?? "";
    const container = code.closest("pre") ?? code;
    try {
      if (MERMAID_CONFIG_DIRECTIVE.test(source)) {
        throw new Error("Mermaid configuration directives are not allowed.");
      }
      const renderId = `mermaid-${previewId}-${index}`;
      const { svg } = await mermaid.render(renderId, source);
      container.replaceWith(renderFigure(sanitizeSvg(svg), index));
    } catch {
      container.replaceWith(renderFailure(source));
    }
  }
}
