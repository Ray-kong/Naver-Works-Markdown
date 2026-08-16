import { FILE_TIMEOUT_MS } from "../shared/limits";
import {
  createFileContentRequest,
  createFileMetadataRequest,
  isFileContentResponse,
  isFileMetadataResponse,
  type BridgeErrorCode,
  type FileContentSuccess,
  type FileMetadataSuccess
} from "./protocol";

export interface FileContentResult {
  text: string;
  fileName: string;
  cacheKey: string;
}

export interface FileMetadataResult {
  fileName: string;
  cacheKey: string;
  isExpiredFile: boolean;
}

export class FileBridgeError extends Error {
  constructor(readonly code: BridgeErrorCode) {
    super(`File bridge request failed: ${code}`);
    this.name = "FileBridgeError";
  }
}

const cache = new Map<string, FileContentResult>();
const targetCacheKeys = new Map<string, string>();

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toResult(response: FileContentSuccess): FileContentResult {
  return { text: response.text, fileName: response.fileName, cacheKey: response.cacheKey };
}

export function requestFileContent(targetId: string): Promise<FileContentResult> {
  const knownKey = targetCacheKeys.get(targetId);
  if (knownKey) {
    const cached = cache.get(knownKey);
    if (cached) return Promise.resolve(cached);
  }

  const id = requestId();
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
    const onMessage = (event: MessageEvent<unknown>): void => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        !isFileContentResponse(event.data) ||
        event.data.requestId !== id
      ) {
        return;
      }
      cleanup();
      if (event.data.kind === "file-content-error") {
        reject(new FileBridgeError(event.data.code));
        return;
      }
      const result = toResult(event.data);
      cache.set(result.cacheKey, result);
      targetCacheKeys.set(targetId, result.cacheKey);
      resolve(result);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new FileBridgeError("timeout"));
    }, FILE_TIMEOUT_MS);

    window.addEventListener("message", onMessage);
    window.postMessage(createFileContentRequest(id, targetId), window.location.origin);
  });
}

const metadataCache = new Map<string, FileMetadataResult>();

export function requestFileMetadata(targetId: string): Promise<FileMetadataResult> {
  const cached = metadataCache.get(targetId);
  if (cached) return Promise.resolve(cached);

  const id = requestId();
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
    const onMessage = (event: MessageEvent<unknown>): void => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        !isFileMetadataResponse(event.data) ||
        event.data.requestId !== id
      ) return;
      cleanup();
      if (event.data.kind === "file-metadata-error") {
        reject(new FileBridgeError(event.data.code));
        return;
      }
      const response: FileMetadataSuccess = event.data;
      const result: FileMetadataResult = {
        fileName: response.fileName,
        cacheKey: response.cacheKey,
        isExpiredFile: response.isExpiredFile
      };
      metadataCache.set(targetId, result);
      resolve(result);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new FileBridgeError("timeout"));
    }, FILE_TIMEOUT_MS);

    window.addEventListener("message", onMessage);
    window.postMessage(createFileMetadataRequest(id, targetId), window.location.origin);
  });
}
