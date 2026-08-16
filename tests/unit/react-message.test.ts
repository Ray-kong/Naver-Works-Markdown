import { describe, expect, it } from "vitest";
import { extractFileMessage } from "../../src/bridge/react-message";

function fileMessage() {
  return {
    messageNo: 42,
    channelNo: "channel-7",
    fromUserNo: "user-9",
    room: { channelNo: "room-channel-8", hidden: "must not cross the bridge" },
    fileName: "README",
    fileExtensionName: "md",
    isExpiredFile: false,
    extras: {
      filename: "README.md",
      filesize: 123,
      resourcepath: "/download/README.md",
      secret: "must not cross the bridge"
    },
    sender: { email: "private@example.test" }
  };
}

describe("React file message extraction", () => {
  it("finds the nearest DOM ancestor fiber and returns only allowlisted metadata", () => {
    const message = document.createElement("div");
    message.className = "msg_wrap";
    const card = document.createElement("div");
    const child = document.createElement("span");
    card.append(child);
    message.append(card);
    document.body.append(message);
    Object.defineProperty(card, "__reactFiber$fixture", {
      value: { return: { memoizedProps: { message: fileMessage() } } }
    });

    expect(extractFileMessage(child)).toEqual({
      messageNo: "42",
      channelNo: "channel-7",
      roomChannelNo: "room-channel-8",
      fromUserNo: "user-9",
      fileName: "README",
      fileExtensionName: "md",
      isExpiredFile: false,
      extras: {
        filename: "README.md",
        filesize: 123,
        resourcepath: "/download/README.md"
      }
    });
  });

  it("checks pendingProps and stops before an 81st fiber ancestor", () => {
    const target = document.createElement("div");
    target.className = "msg_wrap";
    document.body.append(target);
    let fiber: Record<string, unknown> = { pendingProps: { message: fileMessage() } };
    for (let index = 0; index < 80; index += 1) fiber = { return: fiber };
    Object.defineProperty(target, "__reactFiber$fixture", { value: fiber });

    expect(extractFileMessage(target)).toBeUndefined();
  });

  it("fails closed when required fields are absent", () => {
    const target = document.createElement("div");
    target.className = "msg_wrap";
    document.body.append(target);
    Object.defineProperty(target, "__reactFiber$fixture", {
      value: { memoizedProps: { message: { ...fileMessage(), channelNo: undefined } } }
    });
    expect(extractFileMessage(target)).toBeUndefined();
  });

  it("does not search React fibers outside the requested message boundary", () => {
    const outer = document.createElement("div");
    const message = document.createElement("div");
    message.className = "msg_wrap";
    const target = document.createElement("div");
    message.append(target);
    outer.append(message);
    document.body.append(outer);
    Object.defineProperty(outer, "__reactFiber$fixture", {
      value: { memoizedProps: { message: fileMessage() } }
    });

    expect(extractFileMessage(target)).toBeUndefined();
  });
});
