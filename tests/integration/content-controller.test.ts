import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorksPreviewController } from "../../src/content/controller";
import { PREVIEW_TAG_NAME, TARGET_ATTRIBUTE } from "../../src/content/selectors";

const fixture = (name: string): Promise<string> =>
  readFile(path.resolve("tests/fixtures", name), "utf8");

const settleMutations = async (): Promise<void> => {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
};

describe("WorksPreviewController integration", () => {
  let controller: WorksPreviewController;

  beforeEach(() => {
    controller = new WorksPreviewController();
  });

  afterEach(() => {
    controller.stop();
    vi.unstubAllGlobals();
  });

  it("decorates only the Markdown message in an existing chat", async () => {
    document.body.innerHTML = await fixture("works-chat.html");

    controller.start();

    const messages = document.querySelectorAll(".msg_wrap");
    expect(messages[0]?.querySelector(`.msg_area + ${PREVIEW_TAG_NAME}`)).not.toBeNull();
    expect(messages[1]?.querySelector(PREVIEW_TAG_NAME)).toBeNull();
    controller.stop();
  });

  it("decorates a Markdown file card and assigns its bridge target", async () => {
    document.body.innerHTML = await fixture("works-file-card.html");

    controller.start();

    expect(document.querySelector(`.msg_area + ${PREVIEW_TAG_NAME}`)).not.toBeNull();
    expect(document.querySelector(".attach")?.getAttribute(TARGET_ATTRIBUTE)).toMatch(/^wmp-file-/);
    controller.stop();
  });

  it("preserves native message nodes while adding a preview sibling", async () => {
    document.body.innerHTML = await fixture("works-chat.html");
    const message = document.querySelector(".msg_wrap")!;
    const text = message.querySelector(".hl_content")!;
    const checkbox = message.querySelector("input[type='checkbox']")!;
    const menu = message.querySelector(".more_menu")!;

    controller.start();

    expect(message.querySelector(".hl_content")).toBe(text);
    expect(message.querySelector("input[type='checkbox']")).toBe(checkbox);
    expect(message.querySelector(".more_menu")).toBe(menu);
    controller.stop();
  });

  it("remains idempotent when started twice and native content mutates", async () => {
    document.body.innerHTML = await fixture("works-chat.html");
    const message = document.querySelector(".msg_wrap")!;

    controller.start();
    controller.start();
    message.querySelector(".hl_content")?.append(document.createTextNode("\n추가 설명"));
    await settleMutations();

    expect(message.querySelectorAll(PREVIEW_TAG_NAME)).toHaveLength(1);
    controller.stop();
  });

  it("decorates a Markdown message added after startup", async () => {
    document.body.innerHTML = '<div id="chat_room_scroll"><div class="chat_view"></div></div>';
    controller.start();
    const message = document.createElement("div");
    message.className = "msg_wrap";
    message.innerHTML = '<p class="msg hl_content">## 새 메시지</p>';

    document.querySelector(".chat_view")?.append(message);
    await settleMutations();

    expect(message.querySelector(PREVIEW_TAG_NAME)).not.toBeNull();
    controller.stop();
  });

  it("reconnects when the chat scroll container is replaced", async () => {
    document.body.innerHTML = '<main><div id="chat_room_scroll"><div class="chat_view"></div></div></main>';
    controller.start();
    const replacement = document.createElement("div");
    replacement.id = "chat_room_scroll";
    replacement.innerHTML = '<div class="msg_wrap"><p class="msg hl_content"># 교체된 대화방</p></div>';

    document.querySelector("#chat_room_scroll")?.replaceWith(replacement);
    await settleMutations();

    expect(replacement.querySelector(`${PREVIEW_TAG_NAME}`)).not.toBeNull();
    controller.stop();
  });

  it("unobserves preview layout nodes when the chat root is replaced", async () => {
    const observers: Array<{ observe: ReturnType<typeof vi.fn>; unobserve: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal("ResizeObserver", class {
      readonly observe = vi.fn();
      readonly unobserve = vi.fn();
      readonly disconnect = vi.fn();

      constructor() {
        observers.push(this);
      }
    });
    document.body.innerHTML = await fixture("works-chat.html");
    const oldArea = document.querySelector(".msg_area")!;
    const oldParent = oldArea.parentElement!;
    controller.start();
    const replacement = document.createElement("div");
    replacement.id = "chat_room_scroll";
    replacement.innerHTML = '<div class="msg_wrap"><div class="msg_inr"><div class="msg_area"><div class="msg_box"><p class="msg hl_content"># 새 방</p></div></div></div></div>';

    document.querySelector("#chat_room_scroll")?.replaceWith(replacement);
    await settleMutations();

    expect(observers).toHaveLength(1);
    expect(observers[0]?.unobserve).toHaveBeenCalledWith(oldArea);
    expect(observers[0]?.unobserve).toHaveBeenCalledWith(oldParent);
    expect(replacement.querySelector("works-markdown-preview")).not.toBeNull();
    controller.stop();
  });

  it("scans 500 ordinary messages without adding preview controls", () => {
    document.body.innerHTML = `<div id="chat_room_scroll"><div class="chat_view">${
      Array.from({ length: 500 }, (_, index) => `<div class="msg_wrap"><p class="msg hl_content">일반 메시지 ${index}</p></div>`).join("")
    }</div></div>`;

    const started = performance.now();
    controller.start();
    const scanDuration = performance.now() - started;

    expect(document.querySelectorAll(".msg_wrap")).toHaveLength(500);
    expect(document.querySelectorAll(PREVIEW_TAG_NAME)).toHaveLength(0);
    expect(scanDuration).toBeLessThan(100);
    controller.stop();
  });

  it("keeps observer reconciliation below the 50 ms p95 fixture budget", async () => {
    document.body.innerHTML = '<div id="chat_room_scroll"><div class="chat_view"></div></div>';
    controller.start();
    const chat = document.querySelector(".chat_view")!;
    const durations: number[] = [];

    for (let index = 0; index < 20; index += 1) {
      const started = performance.now();
      chat.insertAdjacentHTML("beforeend", `<div class="msg_wrap"><p class="msg hl_content">일반 ${index}</p></div>`);
      await settleMutations();
      durations.push(performance.now() - started);
    }

    durations.sort((left, right) => left - right);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
    expect(p95).toBeLessThan(50);
    controller.stop();
  });
});
