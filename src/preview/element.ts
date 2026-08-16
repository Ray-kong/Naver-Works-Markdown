import { FileBridgeError, requestFileContent, requestFileMetadata } from "../bridge/client";
import { renderMarkdownFragment } from "../render/markdown";
import { FilePreviewError, isPreviewError, PreviewError } from "../shared/errors";
import { MAX_FILE_BYTES } from "../shared/limits";
import { STRINGS } from "../shared/strings";
import type { MessagePreviewData } from "../content/extract";
import { PREVIEW_TAG_NAME } from "../content/selectors";
import { PREVIEW_STYLES } from "./styles";

type FileContentResponse = {
  readonly text: string;
  readonly fileName?: string;
  readonly cacheKey?: string;
  readonly size?: number;
};

let previewSequence = 0;

type MermaidModule = typeof import("../render/mermaid-entry");
let mermaidModule: Promise<MermaidModule> | undefined;

const loadMermaid = (): Promise<MermaidModule> => {
  mermaidModule ??= import(chrome.runtime.getURL("mermaid.js")) as Promise<MermaidModule>;
  return mermaidModule;
};

const asFileContent = (value: unknown, targetId: string): FileContentResponse => {
  if (!value || typeof value !== "object" || !("text" in value) || typeof value.text !== "string") {
    throw new FilePreviewError("INVALID_RESPONSE", "The file bridge returned an invalid response.", targetId);
  }
  const size = "size" in value && typeof value.size === "number" ? value.size : new TextEncoder().encode(value.text).byteLength;
  if (size > MAX_FILE_BYTES) {
    throw new FilePreviewError("FILE_TOO_LARGE", "The file exceeds the preview size limit.", targetId);
  }
  const fileName = "fileName" in value && typeof value.fileName === "string" ? value.fileName : undefined;
  const cacheKey = "cacheKey" in value && typeof value.cacheKey === "string" ? value.cacheKey : undefined;
  return { text: value.text, fileName, cacheKey, size };
};

const errorLabel = (error: unknown): string => {
  if (error instanceof FileBridgeError) {
    if (error.code === "file-too-large") return STRINGS.fileTooLarge;
    if (error.code === "timeout") return STRINGS.fileTimeout;
    if (error.code === "unsupported-file" || error.code === "unsupported-encoding") {
      return STRINGS.unsupportedFile;
    }
  }
  if (isPreviewError(error)) {
    if (error.code === "FILE_TOO_LARGE") return STRINGS.fileTooLarge;
    if (error.code === "FILE_TIMEOUT") return STRINGS.fileTimeout;
    if (error.code === "UNSUPPORTED_FILE") return STRINGS.unsupportedFile;
  }
  return STRINGS.fileError;
};

export interface WorksMarkdownPreviewElement extends HTMLElement {
  configure(data: MessagePreviewData): void;
}

export const createPreviewElement = (): WorksMarkdownPreviewElement => {
  const host = document.createElement(PREVIEW_TAG_NAME) as WorksMarkdownPreviewElement;
  const root = host.attachShadow({ mode: "closed" });
  previewSequence += 1;
  const instanceKey = previewSequence.toString(36);
  let data: MessagePreviewData | null = null;
  let rendered = false;

  const style = document.createElement("style");
  style.textContent = PREVIEW_STYLES;
  const container = document.createElement("div");
  container.className = "preview-root";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = STRINGS.showPreview;
  toggle.setAttribute("aria-expanded", "false");
  const panel = document.createElement("div");
  panel.id = `wmp-preview-panel-${instanceKey}`;
  panel.className = "panel";
  panel.hidden = true;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-live", "polite");
  toggle.setAttribute("aria-controls", panel.id);

  const appendError = (error: unknown): void => {
    const message = document.createElement("p");
    message.className = "error";
    message.setAttribute("role", "alert");
    message.textContent = errorLabel(error);
    panel.append(message);
  };

  const appendMarkdown = async (source: string, key: string, fileName?: string): Promise<void> => {
    const documentRoot = document.createElement("section");
    documentRoot.className = "document";
    if (fileName) {
      const label = document.createElement("p");
      label.className = "filename";
      label.textContent = fileName;
      documentRoot.append(label);
    }
    documentRoot.append(renderMarkdownFragment(source));
    panel.append(documentRoot);
    if (documentRoot.querySelector("code.language-mermaid")) {
      const { renderMermaidBlocks } = await loadMermaid();
      await renderMermaidBlocks(documentRoot, key);
    }
  };

  const render = async (previewData: MessagePreviewData): Promise<void> => {
    try {
      if (previewData.messageText) {
        await appendMarkdown(previewData.messageText, `message:${instanceKey}:${previewData.messageText}`);
      }
    } catch (cause) {
      appendError(new PreviewError("RENDER_FAILED", STRINGS.renderError, { cause }));
    }

    for (const file of previewData.files) {
      const loading = document.createElement("p");
      loading.className = "loading";
      loading.textContent = `${file.fileName}: ${STRINGS.loading}`;
      panel.append(loading);
      try {
        const response: unknown = await requestFileContent(file.targetId);
        const { text, fileName, cacheKey } = asFileContent(response, file.targetId);
        loading.remove();
        await appendMarkdown(
          text,
          `file:${instanceKey}:${cacheKey ?? file.targetId}`,
          fileName ?? file.fileName
        );
      } catch (error) {
        loading.remove();
        appendError(error);
      }
    }
  };

  const togglePreview = async (): Promise<void> => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    toggle.textContent = opening ? STRINGS.hidePreview : STRINGS.showPreview;
    toggle.setAttribute("aria-expanded", String(opening));
    if (!opening || rendered || !data) return;
    rendered = true;
    await render(data);
  };

  host.configure = (nextData: MessagePreviewData): void => {
    data = nextData;
    if (!nextData.messageText && nextData.files.length > 0) {
      toggle.disabled = true;
      toggle.textContent = STRINGS.checkingFile;
      host.setAttribute("data-wmp-file-status", "checking");
      void Promise.allSettled(nextData.files.map((file) => requestFileMetadata(file.targetId))).then((results) => {
        const available = results.some((result) => result.status === "fulfilled" && !result.value.isExpiredFile);
        if (available) {
          toggle.disabled = false;
          toggle.textContent = STRINGS.showPreview;
          host.setAttribute("data-wmp-file-status", "available");
          return;
        }
        const allExpired = results.length > 0 && results.every(
          (result) => result.status === "fulfilled" && result.value.isExpiredFile
        );
        if (allExpired) {
          toggle.textContent = STRINGS.expiredFile;
          toggle.setAttribute("aria-disabled", "true");
          host.setAttribute("data-wmp-file-status", "expired");
          return;
        }

        // A preflight miss can be transient while WORKS is reconciling React.
        // Keep the control usable; the full request repeats every security check
        // and shows a typed inline error if the resource is genuinely invalid.
        toggle.disabled = false;
        toggle.textContent = STRINGS.showPreview;
        toggle.removeAttribute("aria-disabled");
        host.setAttribute("data-wmp-file-status", "unverified");
      });
    }
  };
  toggle.addEventListener("click", () => void togglePreview());
  container.append(toggle, panel);
  root.append(style, container);
  return host;
};

// Kept as a compatibility no-op for callers from earlier builds. Isolated
// extension worlds do not expose a usable CustomElementRegistry.
export const registerPreviewElement = (): void => undefined;
