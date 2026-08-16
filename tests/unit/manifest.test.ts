import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("manifest privacy boundary", () => {
  it("uses MV3 and only the NAVER WORKS talk origin", async () => {
    const manifest = JSON.parse(
      await readFile(path.resolve("manifest.json"), "utf8")
    ) as Record<string, unknown>;

    expect(manifest.manifest_version).toBe(3);
    expect(manifest).not.toHaveProperty("permissions");
    expect(manifest).not.toHaveProperty("host_permissions");
    expect(manifest).not.toHaveProperty("optional_permissions");
    expect(manifest).not.toHaveProperty("optional_host_permissions");

    const contentScripts = manifest.content_scripts as Array<{
      matches: string[];
      world: string;
    }>;

    expect(contentScripts).toHaveLength(2);
    expect(contentScripts.map(({ matches }) => matches)).toEqual([
      ["https://talk.worksmobile.com/*"],
      ["https://talk.worksmobile.com/*"]
    ]);
    expect(contentScripts.map(({ world }) => world)).toEqual(["MAIN", "ISOLATED"]);
    expect(manifest.web_accessible_resources).toEqual([
      {
        resources: ["mermaid.js"],
        matches: ["https://talk.worksmobile.com/*"]
      }
    ]);
  });
});
