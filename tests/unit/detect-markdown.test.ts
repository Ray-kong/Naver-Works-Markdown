import { describe, expect, it } from "vitest";
import { looksLikeMarkdown } from "../../src/render/detect-markdown";

describe("looksLikeMarkdown", () => {
  it.each([
    "# 제목\n\n본문",
    "```ts\nconst value = 1;\n```",
    "| 항목 | 값 |\n| --- | --- |\n| A | B |",
    "- [ ] 해야 할 일",
    "[문서](https://example.com)",
    "> 첫 줄\n> 둘째 줄",
    "**강조**와 `코드`",
    "- 항목 A\n- 항목 B"
  ])("detects meaningful markdown: %s", (source) => {
    expect(looksLikeMarkdown(source)).toBe(true);
  });

  it.each([
    "회의 3시에 시작합니다",
    "---",
    "> 한 줄",
    "**강조**",
    "-",
    "*",
    "안녕하세요!",
    "가격은 3 * 4 입니다"
  ])("does not decorate ordinary chat: %s", (source) => {
    expect(looksLikeMarkdown(source)).toBe(false);
  });
});
