import { detectMarkdown } from "../render/detect-markdown";
import { MAX_MESSAGE_CHARACTERS } from "../shared/limits";
import { PREVIEW_TAG_NAME, TARGET_ATTRIBUTE, WORKS_SELECTORS } from "./selectors";

export interface MarkdownFileTarget {
  readonly fileName: string;
  readonly targetId: string;
}

export interface MessagePreviewData {
  readonly messageText?: string;
  readonly files: readonly MarkdownFileTarget[];
}

let targetSequence = 0;

export const isMarkdownFileName = (fileName: string): boolean => /\.(?:md|markdown)$/i.test(fileName.trim());

const BLOCK_ELEMENTS = new Set(["DIV", "P", "PRE", "BLOCKQUOTE", "LI"]);

const directText = (element: Element): string => {
  const chunks: string[] = [];

  const appendLineBreak = (): void => {
    if (chunks.length > 0 && chunks.at(-1) !== "\n") chunks.push("\n");
  };

  const visit = (node: Node): void => {
    if (node instanceof Text) {
      chunks.push(node.data);
      return;
    }
    if (!(node instanceof Element)) return;
    if (node !== element && (node.matches(PREVIEW_TAG_NAME) || node.matches(WORKS_SELECTORS.fileWrap))) {
      return;
    }
    if (node.tagName === "BR") {
      chunks.push("\n");
      return;
    }

    const isBlock = node !== element && BLOCK_ELEMENTS.has(node.tagName);
    if (isBlock) appendLineBreak();
    for (const child of node.childNodes) visit(child);
    if (isBlock) appendLineBreak();
  };

  visit(element);
  return chunks
    .join("")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const extractMessageText = (message: Element): string => {
  const candidates = [...message.querySelectorAll<HTMLElement>(WORKS_SELECTORS.messageText)]
    .filter((candidate) => candidate.closest(WORKS_SELECTORS.message) === message);
  for (const candidate of candidates) {
    const text = directText(candidate);
    if (text) return text;
  }
  return directText(message);
};

const readFileName = (fileWrap: HTMLElement): string => {
  const named = fileWrap.querySelector<HTMLElement>(WORKS_SELECTORS.fileName);
  return (named?.getAttribute("title") ?? named?.textContent ?? fileWrap.getAttribute("title") ?? "").trim();
};

const ensureTargetId = (fileWrap: HTMLElement): string => {
  const existing = fileWrap.getAttribute(TARGET_ATTRIBUTE)?.trim();
  if (existing) return existing;
  targetSequence += 1;
  const targetId = `wmp-file-${targetSequence.toString(36)}`;
  fileWrap.setAttribute(TARGET_ATTRIBUTE, targetId);
  return targetId;
};

export const extractMarkdownFiles = (message: Element): MarkdownFileTarget[] => {
  const files: MarkdownFileTarget[] = [];
  for (const fileWrap of message.querySelectorAll<HTMLElement>(WORKS_SELECTORS.fileWrap)) {
    if (fileWrap.closest(WORKS_SELECTORS.message) !== message) continue;
    const fileName = readFileName(fileWrap);
    if (!isMarkdownFileName(fileName)) continue;
    files.push({ fileName, targetId: ensureTargetId(fileWrap) });
  }
  return files;
};

export const getMessagePreviewData = (message: Element): MessagePreviewData | null => {
  const rawText = extractMessageText(message);
  const messageText = rawText.length <= MAX_MESSAGE_CHARACTERS && detectMarkdown(rawText) ? rawText : undefined;
  const files = extractMarkdownFiles(message);
  if (!messageText && files.length === 0) return null;
  return { messageText, files };
};

export const previewDataKey = (data: MessagePreviewData): string =>
  JSON.stringify([data.messageText ?? null, data.files.map(({ fileName, targetId }) => [fileName, targetId])]);
