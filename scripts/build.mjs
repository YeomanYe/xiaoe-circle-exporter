import { rm, mkdir, copyFile, cp } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const common = {
  bundle: true,
  platform: "browser",
  target: "chrome109",
  sourcemap: false,
  minify: false,
  logLevel: "info",
};

for (const entry of ["background", "content", "popup", "offscreen"]) {
  await build({
    ...common,
    entryPoints: [resolve(root, `src/${entry}.js`)],
    outfile: resolve(dist, `${entry}.js`),
    format: "iife",
  });
}

await copyFile(resolve(root, "static/manifest.json"), resolve(dist, "manifest.json"));
await copyFile(resolve(root, "static/popup.html"), resolve(dist, "popup.html"));
await copyFile(resolve(root, "static/popup.css"), resolve(dist, "popup.css"));
await copyFile(resolve(root, "static/offscreen.html"), resolve(dist, "offscreen.html"));
await cp(resolve(root, "LICENSE"), resolve(dist, "LICENSE"));

console.log(`Built extension at ${dist}`);
