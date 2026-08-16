import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

const metadata = `// ==UserScript==
// @name         小鹅通助手
// @namespace    https://github.com/YeomanYe/xiaoe-circle-exporter
// @version      0.1.1
// @description  把鹅圈子帖子的正文、附件、完整评论和评论媒体打包下载为 ZIP。
// @author       YeomanYe
// @license      MIT
// @match        https://quanzi.xiaoe-tech.com/*
// @connect      quanzi.xiaoe-tech.com
// @connect      xiaoe-tech.com
// @connect      xiaoeknow.com
// @connect      cos.ap-shanghai.myqcloud.com
// @connect      myqcloud.com
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js
// @run-at       document-idle
// ==/UserScript==
`;

await mkdir(dist, { recursive: true });
await build({
  entryPoints: [resolve(root, "src/userscript.js")],
  outfile: resolve(dist, "xiaoe-helper.user.js"),
  bundle: true,
  platform: "browser",
  target: "chrome109",
  format: "iife",
  globalName: "XiaoeHelperUserscript",
  banner: { js: metadata },
  sourcemap: false,
  minify: false,
  logLevel: "info",
});

console.log(`Built userscript at ${resolve(dist, "xiaoe-helper.user.js")}`);
