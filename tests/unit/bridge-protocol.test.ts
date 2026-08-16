import { describe, expect, it } from "vitest";
import {
  BRIDGE_NAMESPACE,
  BRIDGE_VERSION,
  createFileContentRequest,
  createFileMetadataRequest,
  isFileContentRequest,
  isFileContentResponse,
  isFileMetadataRequest,
  isFileMetadataResponse
} from "../../src/bridge/protocol";

describe("file bridge protocol", () => {
  it("accepts only its exact versioned request envelope", () => {
    const request = createFileContentRequest("correlation-1", "target-1");
    expect(isFileContentRequest(request)).toBe(true);
    expect(isFileContentRequest({ ...request, namespace: `${BRIDGE_NAMESPACE}-other` })).toBe(false);
    expect(isFileContentRequest({ ...request, version: BRIDGE_VERSION + 1 })).toBe(false);
    expect(isFileContentRequest({ ...request, targetId: "" })).toBe(false);
  });

  it("validates the metadata preflight envelope without accepting partial payloads", () => {
    const request = createFileMetadataRequest("metadata-1", "target-1");
    expect(isFileMetadataRequest(request)).toBe(true);
    expect(isFileMetadataRequest({ ...request, targetId: "" })).toBe(false);

    const response = {
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      kind: "file-metadata-success",
      requestId: "metadata-1",
      fileName: "README.md",
      cacheKey: "channel:message",
      isExpiredFile: true
    };
    expect(isFileMetadataResponse(response)).toBe(true);
    expect(isFileMetadataResponse({ ...response, isExpiredFile: undefined })).toBe(false);
  });

  it("validates correlated typed successes without accepting partial payloads", () => {
    const response = {
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      kind: "file-content-success",
      requestId: "correlation-1",
      text: "# README",
      fileName: "README.md",
      cacheKey: "channel:message"
    };
    expect(isFileContentResponse(response)).toBe(true);
    expect(isFileContentResponse({ ...response, text: undefined })).toBe(false);
  });

  it("allows only known error codes", () => {
    const response = {
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      kind: "file-content-error",
      requestId: "correlation-1",
      code: "expired-file"
    };
    expect(isFileContentResponse(response)).toBe(true);
    expect(isFileContentResponse({ ...response, code: "cookies" })).toBe(false);
  });
});
