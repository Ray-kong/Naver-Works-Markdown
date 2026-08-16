import { getMessagePreviewData, previewDataKey } from "./extract";
import { PREVIEW_TAG_NAME, WORKS_SELECTORS } from "./selectors";
import { createPreviewElement } from "../preview/element";

type PreviewLayout = {
  readonly area: Element;
  readonly parent: Element;
  readonly preview: HTMLElement;
};

export class WorksPreviewController {
  #documentObserver: MutationObserver | null = null;
  #chatObserver: MutationObserver | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #chatScroll: Element | null = null;
  readonly #signatures = new WeakMap<Element, string>();
  readonly #layouts = new Map<Element, PreviewLayout>();

  start(): void {
    if (this.#documentObserver) return;
    if (typeof ResizeObserver !== "undefined") {
      this.#resizeObserver = new ResizeObserver((entries) => {
        const resized = new Set(entries.map((entry) => entry.target));
        for (const layout of this.#layouts.values()) {
          if (resized.has(layout.area) || resized.has(layout.parent)) this.#syncLayout(layout);
        }
      });
    }
    this.#documentObserver = new MutationObserver(() => this.#connectToCurrentChat());
    const observationRoot = document.documentElement;
    if (observationRoot) this.#documentObserver.observe(observationRoot, { childList: true, subtree: true });
    this.#connectToCurrentChat();
  }

  stop(): void {
    this.#documentObserver?.disconnect();
    this.#chatObserver?.disconnect();
    this.#resizeObserver?.disconnect();
    this.#documentObserver = null;
    this.#chatObserver = null;
    this.#resizeObserver = null;
    this.#chatScroll = null;
    this.#layouts.clear();
  }

  #connectToCurrentChat(): void {
    const nextChat = document.querySelector(WORKS_SELECTORS.chatScroll);
    if (nextChat === this.#chatScroll && nextChat?.isConnected) return;
    this.#chatObserver?.disconnect();
    this.#chatObserver = null;
    for (const message of [...this.#layouts.keys()]) this.#removeLayout(message);
    this.#chatScroll = nextChat;
    if (!nextChat) return;

    this.#chatObserver = new MutationObserver((records) => this.#handleChatMutations(records));
    this.#chatObserver.observe(nextChat, { childList: true, subtree: true, characterData: true });
    this.#scan(nextChat);
  }

  #handleChatMutations(records: readonly MutationRecord[]): void {
    for (const message of this.#layouts.keys()) {
      if (!message.isConnected) this.#removeLayout(message);
    }
    const messages = new Set<Element>();
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      const containingMessage = target?.closest(WORKS_SELECTORS.message);
      if (containingMessage) messages.add(containingMessage);
      for (const node of record.addedNodes) {
        if (!(node instanceof Element) || node.localName === PREVIEW_TAG_NAME) continue;
        if (node.matches(WORKS_SELECTORS.message)) messages.add(node);
        for (const message of node.querySelectorAll(WORKS_SELECTORS.message)) messages.add(message);
      }
    }
    for (const message of messages) this.#reconcile(message);
  }

  #scan(root: ParentNode): void {
    if (root instanceof Element && root.matches(WORKS_SELECTORS.message)) this.#reconcile(root);
    for (const message of root.querySelectorAll(WORKS_SELECTORS.message)) this.#reconcile(message);
  }

  #reconcile(message: Element): void {
    if (!message.isConnected || message.closest(WORKS_SELECTORS.chatScroll) !== this.#chatScroll) {
      this.#removeLayout(message);
      return;
    }
    const data = getMessagePreviewData(message);
    const existing = message.querySelector(PREVIEW_TAG_NAME);
    if (!data) {
      existing?.remove();
      this.#removeLayout(message);
      this.#signatures.delete(message);
      return;
    }

    const signature = previewDataKey(data);
    if (existing && this.#signatures.get(message) === signature) return;
    this.#removeLayout(message);
    existing?.remove();
    const preview = createPreviewElement();
    preview.configure(data);
    preview.setAttribute("data-wmp-preview", "");
    preview.setAttribute("data-wmp-side", message.classList.contains("msg_rgt") ? "right" : "left");
    const messageArea = message.querySelector(WORKS_SELECTORS.messageArea);
    const messageBox = message.querySelector(WORKS_SELECTORS.messageBox);
    if (messageArea) {
      messageArea.after(preview);
      const parent = messageArea.parentElement;
      if (parent) this.#trackLayout(message, { area: messageArea, parent, preview });
    } else if (messageBox) messageBox.after(preview);
    else message.append(preview);
    this.#signatures.set(message, signature);
  }

  #trackLayout(message: Element, layout: PreviewLayout): void {
    this.#removeLayout(message);
    this.#layouts.set(message, layout);
    this.#resizeObserver?.observe(layout.area);
    this.#resizeObserver?.observe(layout.parent);
    this.#syncLayout(layout);
  }

  #removeLayout(message: Element): void {
    const layout = this.#layouts.get(message);
    if (!layout) return;
    this.#resizeObserver?.unobserve(layout.area);
    this.#resizeObserver?.unobserve(layout.parent);
    this.#layouts.delete(message);
  }

  #syncLayout(layout: PreviewLayout): void {
    const areaBox = layout.area.getBoundingClientRect();
    const parentBox = layout.parent.getBoundingClientRect();
    if (areaBox.width <= 0 || parentBox.width <= 0) {
      layout.preview.style.removeProperty("--wmp-host-width");
      layout.preview.style.removeProperty("--wmp-host-offset");
      return;
    }
    layout.preview.style.setProperty("--wmp-host-width", `${areaBox.width}px`);
    layout.preview.style.setProperty("--wmp-host-offset", `${Math.max(0, areaBox.left - parentBox.left)}px`);
  }
}
