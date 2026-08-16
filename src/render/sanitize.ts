import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "a", "blockquote", "br", "code", "del", "em", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "li", "ol", "p", "pre", "s", "strong", "table", "tbody", "td", "th", "thead", "tr", "ul"
] as const;

const ALLOWED_ATTR = ["class", "href", "title"] as const;
const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export const isSafeUrl = (rawUrl: string): boolean => {
  const value = rawUrl.trim();
  if (value.startsWith("#") || value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(value, "https://talk.worksmobile.com/").protocol);
  } catch {
    return false;
  }
};

export const sanitizeMarkdownHtml = (unsafeHtml: string): string => {
  const sanitized = DOMPurify.sanitize(unsafeHtml, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false
  });

  const template = document.createElement("template");
  template.innerHTML = sanitized;
  for (const element of template.content.querySelectorAll<HTMLElement>("[class]")) {
    const classes = [...element.classList];
    if (element.localName === "code" && classes.length === 1 && classes[0]?.toLowerCase() === "language-mermaid") {
      element.className = "language-mermaid";
    } else {
      element.removeAttribute("class");
    }
  }
  for (const link of template.content.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const href = link.getAttribute("href");
    if (!href || !isSafeUrl(href)) {
      link.removeAttribute("href");
      continue;
    }
    link.setAttribute("rel", "noopener noreferrer");
    link.setAttribute("target", "_blank");
  }
  return template.innerHTML;
};

export const sanitizeHtml = sanitizeMarkdownHtml;
