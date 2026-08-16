import MarkdownIt from "markdown-it";
import { MAX_MESSAGE_CHARACTERS } from "../shared/limits";
import { PreviewError } from "../shared/errors";
import { sanitizeMarkdownHtml } from "./sanitize";

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false
});

const defaultFenceRenderer = markdown.renderer.rules.fence;
markdown.renderer.rules.fence = (tokens, index, options, environment, renderer) => {
  const token = tokens[index];
  if (!token || !defaultFenceRenderer) return renderer.renderToken(tokens, index, options);
  const originalInfo = token.info;
  token.info = originalInfo.trim().toLowerCase() === "mermaid" ? "mermaid" : "";
  try {
    return defaultFenceRenderer(tokens, index, options, environment, renderer);
  } finally {
    token.info = originalInfo;
  }
};

export const renderMarkdown = (source: string): string => {
  if (source.length > MAX_MESSAGE_CHARACTERS) {
    throw new PreviewError("MESSAGE_TOO_LONG", "Markdown source exceeds the message limit.");
  }
  return sanitizeMarkdownHtml(markdown.render(source));
};

export const renderMarkdownFragment = (source: string): DocumentFragment => {
  const template = document.createElement("template");
  template.innerHTML = renderMarkdown(source);
  return template.content;
};

export { markdown as markdownRenderer };
