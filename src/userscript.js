import {
  buildArchiveFilename,
  buildArchiveReadme,
  buildHtml,
  buildMarkdown,
  sanitizeFilename,
} from "./export-format.js";
import { collectPostFromPage } from "./page-collector.js";

const BUTTON_CLASS = "xiaoe-circle-export-button";
const HOST_CLASS = "xiaoe-circle-export-host";
const STYLE_ID = "xiaoe-circle-export-style";
const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;
const MIME_EXTENSIONS = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["audio/mpeg", ".mp3"],
  ["audio/mp4", ".m4a"],
  ["video/mp4", ".mp4"],
]);
const { strToU8, zipSync } = globalThis.fflate || {};

if (typeof strToU8 !== "function" || typeof zipSync !== "function") {
  throw new Error("小鹅通助手依赖 fflate，请确认用户脚本管理器允许加载 @require。");
}

let scanScheduled = false;

installStyles();
scanPage();

const observer = new MutationObserver(scheduleScan);
observer.observe(document.documentElement, { childList: true, subtree: true });

function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    scanPage();
  });
}

function scanPage() {
  if (location.pathname.includes("/feed_detail")) {
    const detailCard = document.querySelector(".feed-item-wrapper, .feed-base-wrapper");
    if (detailCard) attachButton(detailCard, location.href);
    return;
  }

  for (const card of document.querySelectorAll(".feed-base-wrapper")) {
    const detailLink = card.querySelector('a.to-feed-detail[href*="/feed_detail"]');
    if (detailLink) attachButton(card, detailLink.href);
  }
}

function attachButton(card, detailUrl) {
  if (card.querySelector(`:scope .${BUTTON_CLASS}`)) return;
  card.classList.add(HOST_CLASS);
  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.textContent = "打包下载";
  button.title = "下载正文、附件和完整评论";
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.disabled = true;
    button.textContent = "打包中…";
    showToast("正在读取帖子详情…", "working");
    try {
      const data = await collectPostFromPage({
        url: detailUrl,
        documentTitle: document.title,
      });
      const archive = await buildArchive(data, (message) => showToast(message, "working"));
      saveArchive(archive.blob, archive.filename);
      showToast(`下载已开始：${archive.filename}`, "done");
      button.textContent = "打包下载";
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
      button.textContent = "重新打包";
    } finally {
      button.disabled = false;
    }
  });

  card.append(button);
}

async function buildArchive(data, progress) {
  const entries = {};
  const localPathByUrl = new Map();
  const usedPaths = new Set();
  const failures = [];
  let totalBytes = 0;

  for (let index = 0; index < data.resources.length; index += 1) {
    const resource = data.resources[index];
    progress(`正在下载文件 ${index + 1}/${data.resources.length}…`);

    try {
      const response = await downloadResource(resource.url);
      const bytes = new Uint8Array(response.arrayBuffer);
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_ARCHIVE_BYTES) {
        throw new Error("附件总大小超过 500 MB 的安全上限。");
      }

      const path = makeResourcePath(resource, index, response.contentType, usedPaths);
      entries[path] = bytes;
      localPathByUrl.set(resource.url, path);
    } catch (error) {
      failures.push({
        url: resource.url,
        kind: resource.kind,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (failures.length) {
    const firstFailure = failures[0];
    throw new Error(
      `有 ${failures.length} 个文件下载失败，已停止导出以避免生成不完整压缩包：${firstFailure.error}`,
    );
  }

  entries["index.html"] = strToU8(buildHtml(data, localPathByUrl));
  entries["帖子.md"] = strToU8(buildMarkdown(data, localPathByUrl));
  entries["post.json"] = strToU8(
    `${JSON.stringify({ ...data, resources: data.resources.map((item) => ({ ...item, localPath: localPathByUrl.get(item.url) })) }, null, 2)}\n`,
  );
  entries["README.txt"] = strToU8(buildArchiveReadme(data, failures));

  progress("正在生成 ZIP 压缩包…");
  const zipped = zipSync(entries, { level: 0 });
  return {
    blob: new Blob([zipped], { type: "application/zip" }),
    filename: buildArchiveFilename(data),
  };
}

function downloadResource(url) {
  const request = globalThis.GM_xmlhttpRequest || globalThis.GM?.xmlHttpRequest;
  if (typeof request !== "function") return fetchResource(url);

  return new Promise((resolve, reject) => {
    request({
      method: "GET",
      url,
      responseType: "arraybuffer",
      withCredentials: true,
      onload(response) {
        if (response.status < 200 || response.status >= 300) {
          reject(new Error(`HTTP ${response.status}`));
          return;
        }
        resolve({
          arrayBuffer: response.response,
          contentType: getResponseHeader(response, "content-type"),
        });
      },
      onerror() {
        reject(new Error("网络请求失败"));
      },
      ontimeout() {
        reject(new Error("网络请求超时"));
      },
    });
  });
}

async function fetchResource(url) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return {
    arrayBuffer: await response.arrayBuffer(),
    contentType: response.headers.get("content-type")?.split(";")[0] || "",
  };
}

function getResponseHeader(response, name) {
  const headers = String(response.responseHeaders || "");
  const match = headers
    .split(/\r?\n/)
    .map((line) => line.split(":"))
    .find(([key]) => key?.trim().toLowerCase() === name);
  return match?.slice(1).join(":").trim().split(";")[0] || "";
}

function makeResourcePath(resource, index, contentType, usedPaths) {
  let name = resource.name;
  if (!name) {
    try {
      name = decodeURIComponent(new URL(resource.url).pathname.split("/").filter(Boolean).at(-1));
    } catch {
      name = "";
    }
  }

  name = sanitizeFilename(name || `资源-${index + 1}`, `资源-${index + 1}`);
  if (!/\.[a-z0-9]{1,8}$/i.test(name)) name += MIME_EXTENSIONS.get(contentType) || "";
  const directory =
    resource.kind === "attachment"
      ? "files"
      : resource.kind === "post-media"
        ? "media/post"
        : `media/comments/${sanitizeFilename(resource.ownerId, "unknown")}`;
  let candidate = `${directory}/${name}`;
  let suffix = 2;
  while (usedPaths.has(candidate)) {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : "";
    candidate = `${directory}/${stem}-${suffix}${extension}`;
    suffix += 1;
  }
  usedPaths.add(candidate);
  return candidate;
}

function saveArchive(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function showToast(message, state = "working") {
  let toast = document.getElementById("xiaoe-circle-export-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "xiaoe-circle-export-toast";
    document.body.append(toast);
  }
  toast.dataset.state = state;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  if (state !== "working") {
    showToast.timer = setTimeout(() => {
      toast.hidden = true;
    }, 6000);
  }
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${HOST_CLASS} {
      position: relative !important;
    }
    .${BUTTON_CLASS} {
      position: absolute;
      z-index: 3;
      top: 16px;
      right: 16px;
      appearance: none;
      padding: 6px 12px;
      border: 1px solid #3478f6;
      border-radius: 999px;
      color: #3478f6;
      background: #fff;
      font: 500 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      white-space: nowrap;
    }
    .${BUTTON_CLASS}:hover:not(:disabled) { color: #fff; background: #3478f6; }
    .${BUTTON_CLASS}:disabled { cursor: wait; opacity: .6; }
    #xiaoe-circle-export-toast {
      position: fixed;
      z-index: 2147483647;
      right: 24px;
      bottom: 24px;
      max-width: 360px;
      padding: 12px 16px;
      border-radius: 10px;
      color: #fff;
      background: #263044;
      box-shadow: 0 12px 38px rgb(0 0 0 / 22%);
      font: 500 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #xiaoe-circle-export-toast[data-state="done"] { background: #168a5d; }
    #xiaoe-circle-export-toast[data-state="error"] { background: #bf3d3d; }
  `;
  document.head.append(style);
}
