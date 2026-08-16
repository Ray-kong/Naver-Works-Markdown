import { MAX_MESSAGE_CHARACTERS } from "../shared/limits";

export interface MarkdownDetection {
  readonly isMarkdown: boolean;
  readonly score: number;
  readonly reasons: readonly string[];
}

const IMMEDIATE_SIGNALS: ReadonlyArray<readonly [RegExp, number, string]> = [
  [/^```[\w-]*\s*$[\s\S]*?^```\s*$/m, 5, "fenced-code"],
  [/^ {0,3}#{1,6}\s+\S/m, 3, "heading"],
  [/^\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}:?\s*\|/m, 4, "table"],
  [/!?\[[^\]\n]+\]\((?:https?:\/\/|mailto:|\/|#)[^)\s]+(?:\s+["'][^"']*["'])?\)/i, 3, "link"],
  [/^ {0,3}(?:[-+*]\s+)?\[[ xX]\]\s+\S/m, 3, "task-list"],
  [/^\[[^\]\n]+\]:\s+\S+/m, 3, "reference-link"],
  [/^(?: {0,3}>\s+\S.*(?:\n|$)){2,}/m, 3, "multiline-blockquote"]
];

const WEAK_SIGNALS: ReadonlyArray<readonly [RegExp, number, string]> = [
  [/^ {0,3}(?:[-*_]\s*){3,}$/m, 1, "thematic-break"],
  [/^ {0,3}>\s+\S/m, 1, "blockquote"],
  [/(?:^|\n) {0,3}(?:[-+*]|\d+[.)])\s+\S/gm, 1, "list"],
  [/(?:^|[^*])\*\*[^*\n]+\*\*(?:[^*]|$)|__[^_\n]+__/m, 1, "strong"],
  [/(?:^|\s)(?:`[^`\n]+`|~~[^~\n]+~~)(?:\s|[.,!?;:]|$)/m, 1, "inline-markup"]
];

export const scoreMarkdown = (source: string): MarkdownDetection => {
  if (source.length === 0 || source.length > MAX_MESSAGE_CHARACTERS || !source.trim()) {
    return { isMarkdown: false, score: 0, reasons: [] };
  }

  let score = 0;
  const reasons: string[] = [];

  let immediate = false;
  for (const [pattern, weight, reason] of IMMEDIATE_SIGNALS) {
    pattern.lastIndex = 0;
    if (!pattern.test(source)) continue;
    score += weight;
    reasons.push(reason);
    immediate = true;
  }

  const weakReasons = new Set<string>();
  for (const [pattern, weight, reason] of WEAK_SIGNALS) {
    pattern.lastIndex = 0;
    const matches = source.match(pattern);
    if (!matches) continue;
    const multiplier = reason === "list" ? Math.min(matches.length, 3) : 1;
    score += weight * multiplier;
    reasons.push(reason);
    weakReasons.add(reason);
  }

  // A lone bullet is common in ordinary chat. Repeated structural lines are not.
  const structuralLines = source.match(/^ {0,3}(?:[-+*]|\d+[.)]|>)\s+\S/gm)?.length ?? 0;
  if (structuralLines >= 2) {
    score += 1;
    reasons.push("repeated-structure");
    weakReasons.add("repeated-structure");
  }

  return { isMarkdown: immediate || weakReasons.size >= 2, score, reasons };
};

export const detectMarkdown = (source: string): boolean => scoreMarkdown(source).isMarkdown;
export const isLikelyMarkdown = detectMarkdown;
export const looksLikeMarkdown = detectMarkdown;
