import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const manifest = JSON.parse(await readFile(path.join(dist, "manifest.json"), "utf8"));

const fail = (message) => {
  throw new Error(message);
};

if (manifest.manifest_version !== 3) fail("manifest_version must be 3");
const allowedManifestKeys = new Set([
  "manifest_version",
  "name",
  "version",
  "description",
  "web_accessible_resources",
  "content_scripts"
]);
for (const key of Object.keys(manifest)) {
  if (!allowedManifestKeys.has(key)) fail(`Unexpected manifest capability: ${key}`);
}
if (["permissions", "host_permissions", "optional_permissions", "optional_host_permissions"].some((key) => key in manifest)) {
  fail("MVP must not request required or optional permissions");
}

const scripts = manifest.content_scripts ?? [];
const expectedScripts = [
  { matches: ["https://talk.worksmobile.com/*"], js: ["main-world.js"], run_at: "document_start", world: "MAIN" },
  { matches: ["https://talk.worksmobile.com/*"], js: ["content.js"], run_at: "document_idle", world: "ISOLATED" }
];
if (JSON.stringify(scripts) !== JSON.stringify(expectedScripts)) {
  fail("Content scripts must match the exact WORKS-only execution surface");
}
const expectedResources = [{ resources: ["mermaid.js"], matches: ["https://talk.worksmobile.com/*"] }];
if (JSON.stringify(manifest.web_accessible_resources) !== JSON.stringify(expectedResources)) {
  fail("Only the packaged Mermaid chunk may be web-accessible on the WORKS origin");
}

const files = await readdir(dist);
for (const required of ["manifest.json", "content.js", "main-world.js", "mermaid.js"]) {
  if (!files.includes(required)) fail(`Missing build artifact: ${required}`);
}

const forbidden = [
  /https?:\/\/[^"'`\s]+(?:\.js|\.mjs)(?:[?"'`\s]|$)/i,
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /chrome\.debugger/,
  /google-analytics|googletagmanager|segment\.com|sentry\.io/i
];

for (const file of ["content.js", "main-world.js", "mermaid.js"]) {
  const filePath = path.join(dist, file);
  const source = await readFile(filePath, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(source)) fail(`${file} contains forbidden pattern ${pattern}`);
  }
  const bytes = (await stat(filePath)).size;
  if (bytes === 0) fail(`${file} is empty`);
}

console.log("Verified MV3 scope, required artifacts, and remote-code/privacy policy checks.");
