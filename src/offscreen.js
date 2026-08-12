import { strToU8, zipSync } from "fflate";
import {
  buildArchiveReadme,
  buildHtml,
  buildMarkdown,
  sanitizeFilename,
} from "./export-format.js";

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "XIAOE_BUILD_ARCHIVE") return undefined;
  buildAndDownload(message.payload, message.jobId)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
  return true;
});

async function buildAndDownload(data, jobId) {
  const entries = {};
  const localPathByUrl = new Map();
  const usedPaths = new Set();
  const failures = [];
  let totalBytes = 0;

  for (let index = 0; index < data.resources.length; index += 1) {
    const resource = data.resources[index];
    sendProgress(jobId, {
      state: "working",
      message: `正在下载文件 ${index + 1}/${data.resources.length}…`,
    });

    try {
      const response = await fetch(resource.url, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_ARCHIVE_BYTES) {
        throw new Error("附件总大小超过 500 MB 的安全上限。");
      }

      const contentType = response.headers.get("content-type")?.split(";")[0] || "";
      const path = makeResourcePath(resource, index, contentType, usedPaths);
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

  sendProgress(jobId, { state: "working", message: "正在生成 ZIP 压缩包…" });
  const zipped = zipSync(entries, { level: 0 });
  const blobUrl = URL.createObjectURL(new Blob([zipped], { type: "application/zip" }));
  const timestamp = data.exportedAt.replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${sanitizeFilename(data.post.title)}-${timestamp}.zip`;
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  return { blobUrl, filename, resourceCount: data.resources.length };
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

function sendProgress(jobId, progress) {
  chrome.runtime
    .sendMessage({ type: "XIAOE_ARCHIVE_PROGRESS", jobId, ...progress })
    .catch(() => undefined);
}
