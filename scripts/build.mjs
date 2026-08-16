import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

if (!dist.startsWith(`${root}${path.sep}`)) {
  throw new Error("Refusing to clean a directory outside the workspace.");
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const cssAsText = {
  name: "css-as-text",
  setup(buildContext) {
    buildContext.onLoad({ filter: /\.css$/ }, async ({ path: cssPath }) => ({
      contents: `export default ${JSON.stringify(await readFile(cssPath, "utf8"))};`,
      loader: "js"
    }));
  }
};

const common = {
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome120"],
  legalComments: "none",
  minify: true,
  sourcemap: false,
  logLevel: "info"
};

await build({
  ...common,
  entryPoints: [path.join(root, "src/content/index.ts")],
  outfile: path.join(dist, "content.js"),
  plugins: [cssAsText]
});

await build({
  ...common,
  entryPoints: [path.join(root, "src/render/mermaid-entry.ts")],
  outfile: path.join(dist, "mermaid.js"),
  format: "esm"
});

await build({
  ...common,
  entryPoints: [path.join(root, "src/bridge/main-world.ts")],
  outfile: path.join(dist, "main-world.js")
});

await cp(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));
