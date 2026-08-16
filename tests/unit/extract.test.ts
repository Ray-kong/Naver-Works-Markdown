import { describe, expect, it } from "vitest";
import { extractMessageText, getMessagePreviewData } from "../../src/content/extract";

describe("WORKS message extraction", () => {
  it("preserves WORKS br elements as Markdown line breaks", () => {
    const message = document.createElement("div");
    message.className = "msg_wrap";
    message.innerHTML = '<p class="msg hl_content"># 제목<br><br>- 항목 A<br>- 항목 B</p>';

    expect(extractMessageText(message)).toBe("# 제목\n\n- 항목 A\n- 항목 B");
    expect(getMessagePreviewData(message)?.messageText).toContain("- 항목 B");
  });

  it("does not confuse a search-highlight message box with a file card", () => {
    const message = document.createElement("div");
    message.className = "msg_wrap";
    message.innerHTML = '<div class="msg_box hl_box"><p class="msg hl_content">## 검색 결과</p></div>';

    expect(getMessagePreviewData(message)?.messageText).toBe("## 검색 결과");
  });

  it("ignores non-Markdown attachments", () => {
    const message = document.createElement("div");
    message.className = "msg_wrap";
    message.innerHTML = '<div class="attach"><em class="file_name">notes.txt</em></div>';

    expect(getMessagePreviewData(message)).toBeNull();
  });
});
