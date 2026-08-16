import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRIDGE_NAMESPACE, BRIDGE_VERSION, type FileContentRequest } from "../../src/bridge/protocol";

const success = (requestId: string, cacheKey = "channel:message") => ({
  namespace: BRIDGE_NAMESPACE,
  version: BRIDGE_VERSION,
  kind: "file-content-success" as const,
  requestId,
  text: "# README",
  fileName: "README.md",
  cacheKey
});

const dispatchResponse = (data: unknown): void => {
  window.dispatchEvent(new MessageEvent("message", { data, source: window, origin: window.location.origin }));
};

describe("file bridge client integration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("resolves only the response correlated to its request", async () => {
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    const { requestFileContent } = await import("../../src/bridge/client");
    const pending = requestFileContent("target-correlation");
    const request = postMessage.mock.calls[0]?.[0] as FileContentRequest;

    dispatchResponse(success("different-request"));
    dispatchResponse(success(request.requestId));

    await expect(pending).resolves.toEqual({
      text: "# README",
      fileName: "README.md",
      cacheKey: "channel:message"
    });
  });

  it("reuses a successful response for the same target without posting again", async () => {
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    const { requestFileContent } = await import("../../src/bridge/client");
    const first = requestFileContent("target-cache");
    const request = postMessage.mock.calls[0]?.[0] as FileContentRequest;
    dispatchResponse(success(request.requestId, "channel:cached-message"));
    await first;

    const second = await requestFileContent("target-cache");

    expect(second.cacheKey).toBe("channel:cached-message");
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("rejects a correlated bridge error with its typed code", async () => {
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    const { requestFileContent } = await import("../../src/bridge/client");
    const pending = requestFileContent("target-expired");
    const request = postMessage.mock.calls[0]?.[0] as FileContentRequest;

    dispatchResponse({
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      kind: "file-content-error",
      requestId: request.requestId,
      code: "expired-file"
    });

    await expect(pending).rejects.toMatchObject({ code: "expired-file" });
  });

  it("preflights an expired file without requesting its content", async () => {
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    const { requestFileMetadata } = await import("../../src/bridge/client");
    const pending = requestFileMetadata("target-expired-metadata");
    const request = postMessage.mock.calls[0]?.[0] as { requestId: string; kind: string };
    expect(request.kind).toBe("file-metadata-request");

    dispatchResponse({
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      kind: "file-metadata-success",
      requestId: request.requestId,
      fileName: "old.md",
      cacheKey: "channel:expired-message",
      isExpiredFile: true
    });

    await expect(pending).resolves.toMatchObject({ isExpiredFile: true, fileName: "old.md" });
    expect(postMessage).toHaveBeenCalledTimes(1);
  });
});
