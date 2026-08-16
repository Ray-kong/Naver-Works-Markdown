export const WORKS_SELECTORS = {
  chatScroll: "#chat_room_scroll",
  message: ".msg_wrap",
  messageArea: ".msg_area",
  messageBox: ".msg_box",
  messageText: [
    ".msg.hl_content",
    ".msg_text",
    ".message_text",
    ".txt",
    ".text",
    "[class*='msg_text']",
    "[class*='message_text']"
  ].join(","),
  fileWrap: ".attach,.file_wrap",
  fileName: [
    ".file_name",
    ".filename",
    "[class*='file_name']",
    "[title$='.md' i]",
    "[title$='.markdown' i]"
  ].join(",")
} as const;

export const PREVIEW_TAG_NAME = "works-markdown-preview";
export const TARGET_ATTRIBUTE = "data-wmp-target";
