export const BRIDGE_NAMESPACE = "works-markdown-preview/file-bridge" as const;
export const BRIDGE_VERSION = 1 as const;

export const BRIDGE_ERROR_CODES = [
  "invalid-request",
  "target-not-found",
  "metadata-not-found",
  "unsupported-file",
  "expired-file",
  "invalid-resource",
  "fetch-failed",
  "unsupported-encoding",
  "file-too-large",
  "timeout"
] as const;

export type BridgeErrorCode = (typeof BRIDGE_ERROR_CODES)[number];

export interface FileContentRequest {
  namespace: typeof BRIDGE_NAMESPACE;
  version: typeof BRIDGE_VERSION;
  kind: "file-content-request";
  requestId: string;
  targetId: string;
}

export interface FileMetadataRequest {
  namespace: typeof BRIDGE_NAMESPACE;
  version: typeof BRIDGE_VERSION;
  kind: "file-metadata-request";
  requestId: string;
  targetId: string;
}

export interface FileContentSuccess {
  namespace: typeof BRIDGE_NAMESPACE;
  version: typeof BRIDGE_VERSION;
  kind: "file-content-success";
  requestId: string;
  text: string;
  fileName: string;
  cacheKey: string;
}

export interface FileContentError {
  namespace: typeof BRIDGE_NAMESPACE;
  version: typeof BRIDGE_VERSION;
  kind: "file-content-error";
  requestId: string;
  code: BridgeErrorCode;
}

export interface FileMetadataSuccess {
  namespace: typeof BRIDGE_NAMESPACE;
  version: typeof BRIDGE_VERSION;
  kind: "file-metadata-success";
  requestId: string;
  fileName: string;
  cacheKey: string;
  isExpiredFile: boolean;
}

export interface FileMetadataError {
  namespace: typeof BRIDGE_NAMESPACE;
  version: typeof BRIDGE_VERSION;
  kind: "file-metadata-error";
  requestId: string;
  code: BridgeErrorCode;
}

export type FileContentResponse = FileContentSuccess | FileContentError;
export type FileMetadataResponse = FileMetadataSuccess | FileMetadataError;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasEnvelope(value: Record<string, unknown>): boolean {
  return value.namespace === BRIDGE_NAMESPACE && value.version === BRIDGE_VERSION;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

export function isFileContentRequest(value: unknown): value is FileContentRequest {
  if (!isRecord(value) || !hasEnvelope(value)) return false;
  return (
    value.kind === "file-content-request" &&
    isIdentifier(value.requestId) &&
    isIdentifier(value.targetId)
  );
}

export function isFileMetadataRequest(value: unknown): value is FileMetadataRequest {
  if (!isRecord(value) || !hasEnvelope(value)) return false;
  return value.kind === "file-metadata-request" && isIdentifier(value.requestId) && isIdentifier(value.targetId);
}

export function isFileContentResponse(value: unknown): value is FileContentResponse {
  if (!isRecord(value) || !hasEnvelope(value) || !isIdentifier(value.requestId)) return false;

  if (value.kind === "file-content-success") {
    return (
      typeof value.text === "string" &&
      typeof value.fileName === "string" &&
      value.fileName.length > 0 &&
      typeof value.cacheKey === "string" &&
      value.cacheKey.length > 0
    );
  }

  return (
    value.kind === "file-content-error" &&
    typeof value.code === "string" &&
    (BRIDGE_ERROR_CODES as readonly string[]).includes(value.code)
  );
}

export function isFileMetadataResponse(value: unknown): value is FileMetadataResponse {
  if (!isRecord(value) || !hasEnvelope(value) || !isIdentifier(value.requestId)) return false;
  if (value.kind === "file-metadata-success") {
    return (
      typeof value.fileName === "string" &&
      value.fileName.length > 0 &&
      typeof value.cacheKey === "string" &&
      value.cacheKey.length > 0 &&
      typeof value.isExpiredFile === "boolean"
    );
  }
  return (
    value.kind === "file-metadata-error" &&
    typeof value.code === "string" &&
    (BRIDGE_ERROR_CODES as readonly string[]).includes(value.code)
  );
}

export function createFileContentRequest(requestId: string, targetId: string): FileContentRequest {
  return {
    namespace: BRIDGE_NAMESPACE,
    version: BRIDGE_VERSION,
    kind: "file-content-request",
    requestId,
    targetId
  };
}

export function createFileMetadataRequest(requestId: string, targetId: string): FileMetadataRequest {
  return {
    namespace: BRIDGE_NAMESPACE,
    version: BRIDGE_VERSION,
    kind: "file-metadata-request",
    requestId,
    targetId
  };
}
