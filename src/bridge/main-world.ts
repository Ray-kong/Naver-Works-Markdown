import { FILE_TIMEOUT_MS, MAX_FILE_BYTES } from "../shared/limits";
import {
  BRIDGE_NAMESPACE,
  BRIDGE_VERSION,
  isFileContentRequest,
  isFileMetadataRequest,
  type BridgeErrorCode,
  type FileContentError,
  type FileContentRequest,
  type FileContentSuccess,
  type FileMetadataError,
  type FileMetadataRequest,
  type FileMetadataSuccess
} from "./protocol";
import { extractFileMessage, type FileMessageMetadata } from "./react-message";

class BridgeFailure extends Error {
  constructor(readonly code: BridgeErrorCode) {
    super(code);
  }
}

const WORKS_STORAGE_ORIGIN = "https://storage.worksmobile.com";

function fail(code: BridgeErrorCode): never {
  throw new BridgeFailure(code);
}

function extensionOf(value: string): string | undefined {
  const clean = value.split(/[?#]/, 1)[0]?.replace(/\\/g, "/");
  const name = clean?.slice((clean.lastIndexOf("/") ?? -1) + 1);
  const match = name?.match(/\.([^.]+)$/);
  return match?.[1]?.toLowerCase();
}

function markdownExtension(value: string): boolean {
  const extension = value.replace(/^\./, "").toLowerCase();
  return extension === "md" || extension === "markdown";
}

function displayedFileName(metadata: FileMessageMetadata): string {
  if (metadata.extras.filename) return metadata.extras.filename;
  if (extensionOf(metadata.fileName)) return metadata.fileName;
  const extension = extensionOf(metadata.fileExtensionName) ?? metadata.fileExtensionName.replace(/^\./, "");
  return `${metadata.fileName}.${extension}`;
}

function normalizedFileName(value: string): string {
  return value.trim().normalize("NFC");
}

export function validateMetadata(metadata: FileMessageMetadata, target: Element, allowExpired = false): { fileName: string; url: URL } {
  if (metadata.isExpiredFile && !allowExpired) fail("expired-file");
  if (metadata.extras.filesize !== undefined && metadata.extras.filesize > MAX_FILE_BYTES) {
    fail("file-too-large");
  }

  const fileName = displayedFileName(metadata);
  const metadataExtension = extensionOf(metadata.fileExtensionName) ?? metadata.fileExtensionName.replace(/^\./, "").toLowerCase();
  const declaredExtensions = [
    extensionOf(fileName),
    metadataExtension
  ].filter((value): value is string => Boolean(value));
  if (declaredExtensions.length === 0 || declaredExtensions.some((value) => !markdownExtension(value))) {
    fail("unsupported-file");
  }
  if (new Set(declaredExtensions).size !== 1) fail("invalid-resource");

  const resourcePath = metadata.extras.resourcepath;
  if (!resourcePath) fail("invalid-resource");
  let url: URL;
  try {
    url = new URL(resourcePath, WORKS_STORAGE_ORIGIN);
  } catch {
    fail("invalid-resource");
  }
  if (url.origin !== WORKS_STORAGE_ORIGIN || url.username || url.password || url.search || url.hash) {
    fail("invalid-resource");
  }
  const encodedLastSegment = url.pathname.split("/").at(-1) ?? "";
  let decodedLastSegment: string;
  try {
    decodedLastSegment = decodeURIComponent(encodedLastSegment);
  } catch {
    fail("invalid-resource");
  }
  if (!decodedLastSegment || decodedLastSegment.includes("/") || decodedLastSegment.includes("\\")) {
    fail("invalid-resource");
  }
  const resourceExtension = extensionOf(decodedLastSegment);
  if (!resourceExtension || resourceExtension !== declaredExtensions[0]) fail("invalid-resource");

  const visibleNameNode = target.matches(".file_name") ? target : target.querySelector(".file_name");
  const visibleFileName = normalizedFileName(visibleNameNode?.textContent ?? "");
  if (!visibleFileName || visibleFileName !== normalizedFileName(fileName)) fail("invalid-resource");
  url.searchParams.set("channelNo", metadata.roomChannelNo);
  url.searchParams.set("callerNo", metadata.fromUserNo);
  url.searchParams.set("ocn", "1");
  url.searchParams.set("serviceId", "works");
  url.searchParams.set("messageNo", metadata.messageNo);
  return { fileName, url };
}

function findValidatedMetadata(targetId: string, allowExpired = false): {
  metadata: FileMessageMetadata;
  fileName: string;
  url: URL;
} {
  const target = findTarget(targetId);
  if (!target || !target.closest(".msg_wrap")) fail("target-not-found");
  const metadata = extractFileMessage(target);
  if (!metadata) fail("metadata-not-found");
  return { metadata, ...validateMetadata(metadata, target, allowExpired) };
}

export function validateEncoding(response: Response): void {
  const contentType = response.headers.get("content-type");
  if (!contentType) fail("unsupported-file");
  const mimeType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (!mimeType || mimeType === "text/html" || (!mimeType.startsWith("text/") && mimeType !== "application/markdown" && mimeType !== "application/x-markdown" && mimeType !== "application/octet-stream")) {
    fail("unsupported-file");
  }
  const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType)?.[1]?.toLowerCase();
  if (charset && charset !== "utf-8" && charset !== "utf8") fail("unsupported-encoding");

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES) fail("file-too-large");
}

function rejectHtmlDocument(value: string): void {
  let offset = 0;
  while (offset < value.length) {
    while (offset < value.length && (value[offset] === "\uFEFF" || /\s/u.test(value[offset] ?? ""))) offset += 1;
    if (value.startsWith("<!--", offset)) {
      const commentEnd = value.indexOf("-->", offset + 4);
      if (commentEnd < 0) break;
      offset = commentEnd + 3;
      continue;
    }
    const declaration = value.slice(offset, offset + 6).toLowerCase();
    if (declaration.startsWith("<?xml") && /[\s?]/u.test(value[offset + 5] ?? "")) {
      const declarationEnd = value.indexOf("?>", offset + 5);
      if (declarationEnd < 0) break;
      offset = declarationEnd + 2;
      continue;
    }
    break;
  }
  const beginning = value.slice(offset, offset + 160);
  if (/^<!doctype\s+html(?:\s|>)/iu.test(beginning) || /^<(?:html|head|body|meta)(?:\s|>)/iu.test(beginning)) {
    fail("unsupported-file");
  }
}

async function readBoundedUtf8(response: Response): Promise<string> {
  validateEncoding(response);
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_FILE_BYTES) fail("file-too-large");
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      fail("unsupported-encoding");
    }
    rejectHtmlDocument(text);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const chunks: string[] = [];
  let bytesRead = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > MAX_FILE_BYTES) {
      await reader.cancel();
      fail("file-too-large");
    }
    try {
      chunks.push(decoder.decode(value, { stream: true }));
    } catch {
      fail("unsupported-encoding");
    }
  }
  try {
    chunks.push(decoder.decode());
  } catch {
    fail("unsupported-encoding");
  }
  const text = chunks.join("");
  rejectHtmlDocument(text);
  return text;
}

function findTarget(targetId: string): Element | undefined {
  return Array.from(document.querySelectorAll("[data-wmp-target]")).find(
    (element) => element.getAttribute("data-wmp-target") === targetId
  );
}

async function loadFile(request: FileContentRequest): Promise<Omit<FileContentSuccess, "namespace" | "version" | "kind" | "requestId">> {
  const { metadata, fileName, url } = findValidatedMetadata(request.targetId);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FILE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      credentials: "include",
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) fail("fetch-failed");
    const text = await readBoundedUtf8(response);
    return { text, fileName, cacheKey: `${metadata.channelNo}:${metadata.messageNo}` };
  } catch (error) {
    if (error instanceof BridgeFailure) throw error;
    if (controller.signal.aborted) fail("timeout");
    fail("fetch-failed");
  } finally {
    window.clearTimeout(timeout);
  }
}

function loadFileMetadata(request: FileMetadataRequest): Omit<FileMetadataSuccess, "namespace" | "version" | "kind" | "requestId"> {
  const { metadata, fileName } = findValidatedMetadata(request.targetId, true);
  return {
    fileName,
    cacheKey: `${metadata.channelNo}:${metadata.messageNo}`,
    isExpiredFile: metadata.isExpiredFile
  };
}

async function handleRequest(request: FileContentRequest): Promise<void> {
  try {
    const result = await loadFile(request);
    const response: FileContentSuccess = {
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      kind: "file-content-success",
      requestId: request.requestId,
      ...result
    };
    window.postMessage(response, window.location.origin);
  } catch (error) {
    const response: FileContentError = {
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      kind: "file-content-error",
      requestId: request.requestId,
      code: error instanceof BridgeFailure ? error.code : "fetch-failed"
    };
    window.postMessage(response, window.location.origin);
  }
}

function handleMetadataRequest(request: FileMetadataRequest): void {
  try {
    const response: FileMetadataSuccess = {
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      kind: "file-metadata-success",
      requestId: request.requestId,
      ...loadFileMetadata(request)
    };
    window.postMessage(response, window.location.origin);
  } catch (error) {
    const response: FileMetadataError = {
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      kind: "file-metadata-error",
      requestId: request.requestId,
      code: error instanceof BridgeFailure ? error.code : "invalid-resource"
    };
    window.postMessage(response, window.location.origin);
  }
}

export function onBridgeMessage(event: MessageEvent<unknown>): void {
  if (
    event.source !== window ||
    event.origin !== window.location.origin ||
    (!isFileContentRequest(event.data) && !isFileMetadataRequest(event.data))
  ) {
    return;
  }
  if (isFileMetadataRequest(event.data)) handleMetadataRequest(event.data);
  else void handleRequest(event.data);
}

window.addEventListener("message", onBridgeMessage);
