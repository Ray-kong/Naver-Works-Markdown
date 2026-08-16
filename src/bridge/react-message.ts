const MAX_FIBER_ANCESTORS = 80;
const REACT_FIBER_PREFIXES = ["__reactFiber$", "__reactInternalInstance$"] as const;

interface ReactFiberLike {
  return?: ReactFiberLike | null;
  memoizedProps?: unknown;
  pendingProps?: unknown;
}

interface MessageExtras {
  filename?: string;
  filesize?: number;
  resourcepath?: string;
}

export interface FileMessageMetadata {
  messageNo: string;
  channelNo: string;
  roomChannelNo: string;
  fromUserNo: string;
  fileName: string;
  fileExtensionName: string;
  isExpiredFile: boolean;
  extras: MessageExtras;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeId(value: unknown): string | undefined {
  if ((typeof value === "string" || typeof value === "number") && String(value).length > 0) {
    return String(value);
  }
  return undefined;
}

function allowlistMessage(value: unknown): FileMessageMetadata | undefined {
  if (!isRecord(value)) return undefined;

  const messageNo = normalizeId(value.messageNo);
  const channelNo = normalizeId(value.channelNo);
  const fromUserNo = normalizeId(value.fromUserNo);
  const roomChannelNo = isRecord(value.room) ? normalizeId(value.room.channelNo) : undefined;
  if (
    !messageNo ||
    !channelNo ||
    !roomChannelNo ||
    !fromUserNo ||
    typeof value.fileName !== "string" ||
    typeof value.fileExtensionName !== "string" ||
    typeof value.isExpiredFile !== "boolean"
  ) {
    return undefined;
  }

  const sourceExtras = isRecord(value.extras) ? value.extras : {};
  const extras: MessageExtras = {};
  if (typeof sourceExtras.filename === "string") extras.filename = sourceExtras.filename;
  if (typeof sourceExtras.filesize === "number" && Number.isFinite(sourceExtras.filesize)) {
    extras.filesize = sourceExtras.filesize;
  }
  if (typeof sourceExtras.resourcepath === "string") extras.resourcepath = sourceExtras.resourcepath;

  return {
    messageNo,
    channelNo,
    roomChannelNo,
    fromUserNo,
    fileName: value.fileName,
    fileExtensionName: value.fileExtensionName,
    isExpiredFile: value.isExpiredFile,
    extras
  };
}

function messageFromProps(props: unknown): FileMessageMetadata | undefined {
  if (!isRecord(props)) return undefined;
  return allowlistMessage(props.message);
}

function nearestFiber(target: Element, boundary: Element): ReactFiberLike | undefined {
  let element: Element | null = target;
  while (element) {
    for (const key of Object.getOwnPropertyNames(element)) {
      if (REACT_FIBER_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        const fiber = (element as unknown as Record<string, unknown>)[key];
        if (isRecord(fiber)) return fiber as ReactFiberLike;
      }
    }
    if (element === boundary) break;
    element = element.parentElement;
  }
  return undefined;
}

export function extractFileMessage(target: Element): FileMessageMetadata | undefined {
  const messageBoundary = target.closest(".msg_wrap");
  if (!messageBoundary) return undefined;
  let fiber: ReactFiberLike | null | undefined = nearestFiber(target, messageBoundary);
  for (let depth = 0; fiber && depth < MAX_FIBER_ANCESTORS; depth += 1) {
    const message = messageFromProps(fiber.memoizedProps) ?? messageFromProps(fiber.pendingProps);
    if (message) return message;
    fiber = fiber.return;
  }
  return undefined;
}
