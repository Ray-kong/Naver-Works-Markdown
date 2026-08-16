import { expect, test, chromium } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const cachedChromiumExecutable = (): string | undefined => {
  const expected = chromium.executablePath();
  if (existsSync(expected)) return expected;
  const cacheRoot = process.env.PLAYWRIGHT_BROWSERS_PATH ?? (
    process.platform === "win32"
      ? path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright")
      : path.join(os.homedir(), ".cache", "ms-playwright")
  );
  if (!existsSync(cacheRoot)) return undefined;
  const revisions = readdirSync(cacheRoot).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse();
  for (const revision of revisions) {
    for (const relative of ["chrome-win64/chrome.exe", "chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
      const candidate = path.join(cacheRoot, revision, relative);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
};

const expectedChromiumExecutable = (): string | undefined => {
  const executable = chromium.executablePath();
  return existsSync(executable) ? executable : undefined;
};

test("the MV3 extension injects into a routed NAVER WORKS page", async () => {
  const extensionPath = path.resolve("dist");
  const fixture = await readFile(path.resolve("tests/fixtures/works-chat.html"), "utf8");
  const executablePath = expectedChromiumExecutable();
  test.skip(!executablePath, "The Chromium revision required by this Playwright package is not installed.");
  if (!executablePath) return;
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "works-markdown-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    executablePath,
    // Chromium only side-loads unpacked extensions reliably in headed mode.
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    await context.route("https://talk.worksmobile.com/fixture", (route) =>
      route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: fixture })
    );
    const page = await context.newPage();
    await page.goto("https://talk.worksmobile.com/fixture");

    await expect(page.locator(".msg_wrap").first().locator("works-markdown-preview")).toHaveCount(1);
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});

test("the built content bundle decorates a routed page without replacing native controls", async () => {
  const fixture = await readFile(path.resolve("tests/fixtures/works-chat.html"), "utf8");
  const executablePath = cachedChromiumExecutable();
  test.skip(!executablePath, "No cached Chromium executable is available for browser testing.");
  if (!executablePath) return;
  const browser = await chromium.launch({ executablePath, headless: true });

  try {
    const page = await browser.newPage();
    await page.route("https://talk.worksmobile.com/fixture", (route) =>
      route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: fixture })
    );
    await page.goto("https://talk.worksmobile.com/fixture");
    await page.locator(".chat_view").evaluate((chat) => {
      chat.insertAdjacentHTML("beforeend", `
        <div class="msg_rgt msg_wrap"><div><div class="msg_inr"><div class="msg_area">
          <div class="msg_box"><p class="msg hl_content">## 오른쪽 Markdown\n\n- 항목 A\n- 항목 B</p></div>
          <div class="status_box">오후 2:00</div>
        </div></div></div></div>
        <div class="msg_lft msg_wrap"><div><div class="msg_inr"><div class="msg_area">
          <div><div class="msg_box"><div class="attach"><em class="file_name">GUIDE.md</em></div></div></div>
          <div class="status_box">오후 2:01</div>
        </div><div class="msg_btns">전달 | 저장</div></div></div></div>
      `);
    });
    await page.addStyleTag({ content: `
      .msg_wrap { display:flow-root; margin-bottom:16px; width:900px; }
      .msg_inr { width:258px; }
      .msg_rgt .msg_inr { margin-left:auto; }
      .msg_area { display:flow-root; margin-left:48px; position:relative; width:210px; }
      .msg_box { float:left; margin-top:22px; width:210px; }
      .msg_rgt .msg_box { float:right; }
      .status_box { bottom:0; left:218px; position:absolute; width:60px; }
      .msg_rgt .status_box { left:auto; right:218px; }
    ` });
    await page.addScriptTag({ path: path.resolve("dist/content.js") });

    const firstMessage = page.locator(".msg_wrap").first();
    const leftPreview = firstMessage.locator(".msg_area + works-markdown-preview");
    const rightMessage = page.locator(".msg_wrap").nth(2);
    const rightPreview = rightMessage.locator(".msg_area + works-markdown-preview");
    const fileMessage = page.locator(".msg_wrap").nth(3);
    const filePreview = fileMessage.locator(".msg_area + works-markdown-preview");
    await expect(leftPreview).toHaveCount(1);
    await expect(rightPreview).toHaveCount(1);
    await expect(filePreview).toHaveCount(1);
    await expect(leftPreview).toHaveAttribute("data-wmp-side", "left");
    await expect(rightPreview).toHaveAttribute("data-wmp-side", "right");
    await expect(page.locator(".msg_wrap").nth(1).locator("works-markdown-preview")).toHaveCount(0);
    await expect(page.locator(".msg_wrap").first().locator(".hl_content")).toContainText("릴리스 안내");
    await expect(page.locator(".msg_wrap").first().locator(".more_menu")).toHaveCount(1);
    const bubbleBox = await firstMessage.locator(".msg_box").boundingBox();
    const collapsedPreviewBox = await leftPreview.boundingBox();
    expect((collapsedPreviewBox?.y ?? 0)).toBeGreaterThanOrEqual((bubbleBox?.y ?? 0) + (bubbleBox?.height ?? 0) - 1);
    const leftAreaBefore = await firstMessage.locator(".msg_area").boundingBox();
    const leftStatusBefore = await firstMessage.locator(".status_box").boundingBox();
    const rightAreaBefore = await rightMessage.locator(".msg_area").boundingBox();
    const rightStatusBefore = await rightMessage.locator(".status_box").boundingBox();
    const relativePosition = (
      child: { x: number; y: number } | null,
      parent: { x: number; y: number } | null
    ) => ({ x: (child?.x ?? 0) - (parent?.x ?? 0), y: (child?.y ?? 0) - (parent?.y ?? 0) });
    const leftStatusOffset = relativePosition(leftStatusBefore, leftAreaBefore);
    const rightStatusOffset = relativePosition(rightStatusBefore, rightAreaBefore);
    await page.mouse.click((collapsedPreviewBox?.x ?? 0) + 28, (collapsedPreviewBox?.y ?? 0) + 20);
    const rightCollapsedBox = await rightPreview.boundingBox();
    await page.mouse.click(
      (rightCollapsedBox?.x ?? 0) + (rightCollapsedBox?.width ?? 0) - 28,
      (rightCollapsedBox?.y ?? 0) + 20
    );
    await expect.poll(async () => (await leftPreview.boundingBox())?.height ?? 0).toBeGreaterThan(100);
    await expect.poll(async () => (await rightPreview.boundingBox())?.height ?? 0).toBeGreaterThan(100);
    expect((await leftPreview.boundingBox())?.width).toBeCloseTo(210, 0);
    expect((await rightPreview.boundingBox())?.width).toBeCloseTo(210, 0);
    const leftAreaAfter = await firstMessage.locator(".msg_area").boundingBox();
    const rightAreaAfter = await rightMessage.locator(".msg_area").boundingBox();
    expect(leftAreaAfter?.width).toBe(leftAreaBefore?.width);
    expect(rightAreaAfter?.width).toBe(rightAreaBefore?.width);
    expect(relativePosition(await firstMessage.locator(".status_box").boundingBox(), leftAreaAfter)).toEqual(leftStatusOffset);
    expect(relativePosition(await rightMessage.locator(".status_box").boundingBox(), rightAreaAfter)).toEqual(rightStatusOffset);
    expect(await fileMessage.locator(".msg_area").boundingBox()).toEqual(expect.objectContaining({ width: 210 }));
    const fileAreaBox = await fileMessage.locator(".msg_area").boundingBox();
    const filePreviewBox = await filePreview.boundingBox();
    expect(filePreviewBox?.y ?? 0).toBeGreaterThanOrEqual((fileAreaBox?.y ?? 0) + (fileAreaBox?.height ?? 0) - 1);

    await page.locator(".msg_inr").evaluateAll((elements) => {
      for (const element of elements) (element as HTMLElement).style.width = "318px";
    });
    await page.locator(".msg_area").evaluateAll((elements) => {
      for (const element of elements) (element as HTMLElement).style.width = "270px";
    });
    await expect.poll(async () => (await leftPreview.boundingBox())?.width ?? 0).toBeCloseTo(270, 0);
    await expect.poll(async () => (await rightPreview.boundingBox())?.width ?? 0).toBeCloseTo(270, 0);
    await expect.poll(async () => (await filePreview.boundingBox())?.width ?? 0).toBeCloseTo(270, 0);
    const resizedLeftArea = await firstMessage.locator(".msg_area").boundingBox();
    const resizedRightArea = await rightMessage.locator(".msg_area").boundingBox();
    expect((await leftPreview.boundingBox())?.x).toBeCloseTo(resizedLeftArea?.x ?? 0, 0);
    expect((await rightPreview.boundingBox())?.x).toBeCloseTo(resizedRightArea?.x ?? 0, 0);

    const cdp = await page.context().newCDPSession(page);
    const documentTree = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
    const previewHosts: any[] = [];
    const collectHosts = (node: any): void => {
      if (node.nodeName === "WORKS-MARKDOWN-PREVIEW") previewHosts.push(node);
      for (const shadow of node.shadowRoots ?? []) collectHosts(shadow);
      for (const child of node.children ?? []) collectHosts(child);
    };
    collectHosts(documentTree.root);
    const panelBoxes = [];
    for (const hostNode of previewHosts.slice(0, 2)) {
      const previewRoot = hostNode.shadowRoots?.[0]?.children?.find((node: any) => node.nodeName === "DIV");
      const panelNode = previewRoot?.children?.filter((node: any) => node.nodeName === "DIV").at(-1);
      const box = await cdp.send("DOM.getBoxModel", { backendNodeId: panelNode.backendNodeId });
      panelBoxes.push({ left: box.model.border[0], right: box.model.border[2] });
    }
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(panelBoxes[0]?.left).toBeGreaterThanOrEqual(0);
    expect(panelBoxes[0]?.right).toBeLessThanOrEqual(viewportWidth);
    expect(panelBoxes[1]?.left).toBeGreaterThanOrEqual(0);
    expect(panelBoxes[1]?.right).toBeLessThanOrEqual(viewportWidth);
  } finally {
    await browser.close();
  }
});

test("the MV3 extension loads the packaged Mermaid renderer only when a preview opens", async () => {
  const extensionPath = path.resolve("dist");
  const executablePath = expectedChromiumExecutable();
  test.skip(!executablePath, "The Chromium revision required by this Playwright package is not installed.");
  if (!executablePath) return;
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "works-mermaid-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    executablePath,
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });

  try {
    const markdown = [
      "```mermaid\nflowchart TD\nA-->B\n```",
      "```mermaid\nsequenceDiagram\nA->>B: Hello\n```",
      "```mermaid\nclassDiagram\nclass Animal\n```",
      "```mermaid\nstateDiagram-v2\n[*] --> Ready\n```"
    ].join("\n\n");
    const html = `<div id="chat_room_scroll"><div class="msg_wrap"><p class="msg hl_content">${markdown}</p></div></div>`;
    await context.route("https://talk.worksmobile.com/mermaid-fixture", (route) =>
      route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html })
    );
    const page = await context.newPage();
    const mermaidRequests: string[] = [];
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    cdp.on("Network.requestWillBeSent", ({ request }) => {
      if (request.url.endsWith("/mermaid.js")) mermaidRequests.push(request.url);
    });
    await page.goto("https://talk.worksmobile.com/mermaid-fixture");

    const host = page.locator("works-markdown-preview");
    await expect(host).toHaveCount(1);
    expect(mermaidRequests).toHaveLength(0);
    const before = await host.boundingBox();
    expect(before).not.toBeNull();
    const renderStarted = performance.now();
    await page.mouse.click((before?.x ?? 0) + 28, (before?.y ?? 0) + 13);
    await cdp.send("DOM.enable");
    await cdp.send("Accessibility.enable");
    const svgCount = async (): Promise<number> => {
      const tree = await cdp.send("Accessibility.getFullAXTree");
      return tree.nodes.filter((node) => node.role?.value === "image" && String(node.name?.value ?? "").includes("Mermaid")).length;
    };
    await expect.poll(svgCount, { timeout: 1_000 }).toBe(4);
    expect(performance.now() - renderStarted).toBeLessThan(1_000);
    expect(mermaidRequests).toHaveLength(1);
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});
