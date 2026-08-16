export type PreviewErrorCode =
  | "FILE_NOT_FOUND"
  | "FILE_TOO_LARGE"
  | "FILE_TIMEOUT"
  | "INVALID_RESPONSE"
  | "MESSAGE_TOO_LONG"
  | "UNSUPPORTED_FILE"
  | "RENDER_FAILED";

export class PreviewError extends Error {
  readonly code: PreviewErrorCode;

  constructor(code: PreviewErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PreviewError";
    this.code = code;
  }
}

export class FilePreviewError extends PreviewError {
  readonly targetId: string | undefined;

  constructor(
    code: Extract<
      PreviewErrorCode,
      "FILE_NOT_FOUND" | "FILE_TOO_LARGE" | "FILE_TIMEOUT" | "INVALID_RESPONSE" | "UNSUPPORTED_FILE"
    >,
    message: string,
    targetId?: string,
    options?: ErrorOptions
  ) {
    super(code, message, options);
    this.name = "FilePreviewError";
    this.targetId = targetId;
  }
}

export class RenderPreviewError extends PreviewError {
  constructor(message: string, options?: ErrorOptions) {
    super("RENDER_FAILED", message, options);
    this.name = "RenderPreviewError";
  }
}

export const isPreviewError = (value: unknown): value is PreviewError => value instanceof PreviewError;

export const normalizePreviewError = (value: unknown, fallbackMessage: string): PreviewError => {
  if (isPreviewError(value)) return value;
  return new RenderPreviewError(fallbackMessage, { cause: value });
};
