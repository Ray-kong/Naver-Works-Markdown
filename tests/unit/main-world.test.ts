import { describe, expect, it, vi } from "vitest";
import { onBridgeMessage, validateEncoding, validateMetadata } from "../../src/bridge/main-world";
import type { FileMessageMetadata } from "../../src/bridge/react-message";
import { BRIDGE_NAMESPACE, BRIDGE_VERSION } from "../../src/bridge/protocol";

const metadata = (overrides: Partial<FileMessageMetadata> = {}): FileMessageMetadata => ({
  messageNo: "message-1",
  channelNo: "channel-1",
  roomChannelNo: "room-channel-1",
  fromUserNo: "user-1",
  fileName: "README",
  fileExtensionName: "md",
  isExpiredFile: false,
  extras: {
    filename: "README.md",
    filesize: 128,
    resourcepath: "/download/README.md"
  },
  ...overrides
});

const reactMetadata = (overrides: Partial<FileMessageMetadata> = {}) => {
  const value = metadata(overrides);
  return { ...value, room: { channelNo: value.roomChannelNo } };
};

const target = (visibleName = "README.md"): HTMLElement => {
  const card = document.createElement("div");
  card.className = "attach";
  if (visibleName) {
    const name = document.createElement("em");
    name.className = "file_name";
    name.textContent = visibleName;
    card.append(name);
  }
  return card;
};

const requestFileBody = async (body: string, contentType = "text/plain; charset=utf-8") => {
  const message = document.createElement("div");
  message.className = "msg_wrap";
  const card = target();
  card.setAttribute("data-wmp-target", "body-target");
  message.append(card);
  document.body.append(message);
  Object.defineProperty(card, "__reactFiber$fixture", {
    value: { memoizedProps: { message: reactMetadata() } }
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { headers: { "content-type": contentType } }));
  const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);

  onBridgeMessage(new MessageEvent("message", {
    source: window,
    origin: window.location.origin,
    data: {
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      kind: "file-content-request",
      requestId: "body-request",
      targetId: "body-target"
    }
  }));

  await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
  return postMessage.mock.calls.at(-1)?.[0];
};

describe("main-world file validation", () => {
  it("accepts only an exact visible filename and the WORKS storage resource", () => {
    const result = validateMetadata(metadata(), target());

    expect(result.fileName).toBe("README.md");
    expect(result.url.origin).toBe("https://storage.worksmobile.com");
    expect(Object.fromEntries(result.url.searchParams)).toEqual({
      channelNo: "room-channel-1",
      callerNo: "user-1",
      ocn: "1",
      serviceId: "works",
      messageNo: "message-1"
    });
  });

  it("accepts the live WORKS shape where fileExtensionName contains the full filename", () => {
    const result = validateMetadata(metadata({ fileName: "README.md", fileExtensionName: "README.md" }), target());

    expect(result.fileName).toBe("README.md");
  });

  it.each([
    ["missing visible filename", metadata(), target("")],
    ["different visible filename", metadata(), target("OTHER.md")],
    ["extensionless resource", metadata({ extras: { filename: "README.md", resourcepath: "/download/file-resource-123" } }), target()],
    ["mismatched suffix", metadata({ extras: { filename: "README.md", resourcepath: "/download/README.txt" } }), target()],
    ["encoded mismatched suffix", metadata({ extras: { filename: "README.md", resourcepath: "/download/README%2Etxt" } }), target()],
    ["encoded path separator", metadata({ extras: { filename: "README.md", resourcepath: "/download/folder%2FREADME.md" } }), target()],
    ["cross-origin resource", metadata({ extras: { filename: "README.md", resourcepath: "https://attacker.invalid/README.md" } }), target()],
    ["resource query injection", metadata({ extras: { filename: "README.md", resourcepath: "/download/README.md?serviceId=evil" } }), target()]
  ])("rejects %s", (_label, fileMetadata, card) => {
    expect(() => validateMetadata(fileMetadata, card)).toThrow();
  });

  it("requires an allowlisted textual Content-Type", () => {
    expect(() => validateEncoding(new Response(new Uint8Array([35, 32, 116])))).toThrow();
    expect(() => validateEncoding(new Response("# title", { headers: { "content-type": "application/pdf" } }))).toThrow();
    expect(() => validateEncoding(new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } }))).toThrow();
    expect(() => validateEncoding(new Response("# title", { headers: { "content-type": "application/octet-stream" } }))).not.toThrow();
    expect(() => validateEncoding(new Response("# title", { headers: { "content-type": "text/markdown; charset=utf-8" } }))).not.toThrow();
  });

  it("binds the requested card fiber to the official credentialed storage fetch", async () => {
    const message = document.createElement("div");
    message.className = "msg_wrap";
    const card = target();
    card.setAttribute("data-wmp-target", "file-target-1");
    message.append(card);
    document.body.append(message);
    Object.defineProperty(card, "__reactFiber$fixture", {
      value: { memoizedProps: { message: reactMetadata() } }
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("# README", { headers: { "content-type": "text/markdown; charset=utf-8" } })
    );
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);

    onBridgeMessage(new MessageEvent("message", {
      source: window,
      origin: window.location.origin,
      data: {
        namespace: BRIDGE_NAMESPACE,
        version: BRIDGE_VERSION,
        kind: "file-content-request",
        requestId: "request-1",
        targetId: "file-target-1"
      }
    }));

    await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://storage.worksmobile.com/download/README.md?channelNo=room-channel-1&callerNo=user-1&ocn=1&serviceId=works&messageNo=message-1"),
      expect.objectContaining({
        credentials: "include",
        redirect: "error",
        signal: expect.any(AbortSignal)
      })
    );
    expect(postMessage.mock.calls.at(-1)?.[0]).toMatchObject({
      kind: "file-content-success",
      text: "# README",
      fileName: "README.md",
      cacheKey: "channel-1:message-1"
    });
  });

  it.each([
    ["doctype", "<!DOCTYPE html><html><head><title>404</title></head></html>"],
    ["body", "<body>not a Markdown file</body>"],
    ["comment-prefixed", "<!-- WORKS error -->\n<html><head></head></html>"],
    ["XML-prefixed", "<?xml version=\"1.0\"?>\n<head><meta charset=\"utf-8\"></head>"],
    ["meta-prefixed", "\uFEFF  <meta charset=\"utf-8\"><title>404</title>"]
  ])("rejects a %s HTML error document returned as text", async (_label, body) => {
    expect(await requestFileBody(body)).toMatchObject({
      kind: "file-content-error",
      code: "unsupported-file"
    });
  });

  it.each(["<header>Markdown heading wrapper</header>", "<headline>not an HTML document root</headline>", "<html-example>custom text</html-example>"])(
    "does not reject boundary-safe Markdown text: %s",
    async (body) => {
      expect(await requestFileBody(body)).toMatchObject({
        kind: "file-content-success",
        text: body
      });
    }
  );

  it("returns expired status during metadata preflight without fetching", async () => {
    const message = document.createElement("div");
    message.className = "msg_wrap";
    const card = target("README.md");
    card.setAttribute("data-wmp-target", "expired-target");
    message.append(card);
    document.body.append(message);
    Object.defineProperty(card, "__reactFiber$fixture", {
      value: { memoizedProps: { message: reactMetadata({ isExpiredFile: true }) } }
    });
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);

    onBridgeMessage(new MessageEvent("message", {
      source: window,
      origin: window.location.origin,
      data: {
        namespace: BRIDGE_NAMESPACE,
        version: BRIDGE_VERSION,
        kind: "file-metadata-request",
        requestId: "metadata-request-1",
        targetId: "expired-target"
      }
    }));

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      kind: "file-metadata-success",
      isExpiredFile: true
    }), window.location.origin);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
