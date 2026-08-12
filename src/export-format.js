const ILLEGAL_FILENAME = /[<>:"/\\|?*\u0000-\u001f]/g;

export function sanitizeFilename(value, fallback = "鹅圈子帖子") {
  const normalized = String(value || "")
    .normalize("NFKC")
    .replace(ILLEGAL_FILENAME, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return (normalized || fallback).slice(0, 100);
}

export function buildArchiveFilename(data) {
  const sourceTime = data.post?.createdAt || data.exportedAt;
  const timestamp = String(sourceTime || "")
    .trim()
    .replace(/[T\s]+/g, "-")
    .replace(/[:.]/g, "-")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 19);
  const title = sanitizeFilename(data.post?.title);
  return `${title}-${timestamp || "时间未知"}.zip`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markdownText(value) {
  return String(value ?? "").replace(/([\\`*_{}\[\]<>#+.!|-])/g, "\\$1");
}

function formatBytes(size) {
  const bytes = Number(size || 0);
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function renderMarkdownResources(urls, localPathByUrl, indent = "") {
  const lines = [];
  for (const url of urls || []) {
    const localPath = localPathByUrl.get(url);
    if (localPath) lines.push(`${indent}- [媒体文件](${encodeURI(localPath)})`);
    else lines.push(`${indent}- 媒体下载失败：${url}`);
  }
  return lines;
}

function renderMarkdownComment(comment, localPathByUrl, depth = 0) {
  const indent = "  ".repeat(depth);
  const role = comment.role ? ` · ${markdownText(comment.role)}` : "";
  const location = comment.location ? ` · ${markdownText(comment.location)}` : "";
  const time = markdownText(comment.createdAt || comment.displayTime || "时间未知");
  const lines = [
    `${indent}- **${markdownText(comment.author)}${role}** · ${time}${location}`,
  ];
  if (comment.text) lines.push(`${indent}  ${markdownText(comment.text).replaceAll("\n", `\n${indent}  `)}`);
  lines.push(...renderMarkdownResources(comment.resources, localPathByUrl, `${indent}  `));
  for (const reply of comment.replies || []) {
    lines.push(...renderMarkdownComment(reply, localPathByUrl, depth + 1));
  }
  return lines;
}

export function buildMarkdown(data, localPathByUrl = new Map()) {
  const { post, community, comments } = data;
  const lines = [
    `# ${markdownText(post.title)}`,
    "",
    `- 社群：${markdownText(community.title)}`,
    `- 作者：${markdownText(post.author)}`,
    `- 时间：${markdownText(post.createdAt || post.displayTime || "时间未知")}`,
    `- IP 属地：${markdownText(post.location || "未显示")}`,
    `- 来源：${data.sourceUrl}`,
    `- 导出时间：${data.exportedAt}`,
    "",
    "## 正文",
    "",
    post.text || "（无文字正文）",
    "",
    "## 附件",
    "",
  ];

  if (post.attachments.length === 0) {
    lines.push("（无附件）");
  } else {
    for (const attachment of post.attachments) {
      const path = localPathByUrl.get(attachment.url);
      const size = formatBytes(attachment.size);
      lines.push(
        path
          ? `- [${markdownText(attachment.name)}](${encodeURI(path)})${size ? ` · ${size}` : ""}`
          : `- ${markdownText(attachment.name)} · 下载失败 · ${attachment.url}`,
      );
    }
  }

  lines.push("", `## 评论（${comments.length} 条一级评论）`, "");
  if (comments.length === 0) lines.push("（暂无评论）");
  for (const comment of comments) lines.push(...renderMarkdownComment(comment, localPathByUrl));
  return `${lines.join("\n")}\n`;
}

function renderHtmlMedia(urls, localPathByUrl) {
  return (urls || [])
    .map((url) => {
      const path = localPathByUrl.get(url);
      return path
        ? `<a class="media" href="${escapeHtml(path)}"><img src="${escapeHtml(path)}" alt="评论媒体" loading="lazy"></a>`
        : `<p class="download-error">媒体下载失败：${escapeHtml(url)}</p>`;
    })
    .join("");
}

function renderHtmlComment(comment, localPathByUrl, depth = 0) {
  const role = comment.role ? `<span class="role">${escapeHtml(comment.role)}</span>` : "";
  const meta = [comment.createdAt || comment.displayTime, comment.location].filter(Boolean).join(" · ");
  const replies = (comment.replies || [])
    .map((reply) => renderHtmlComment(reply, localPathByUrl, depth + 1))
    .join("");
  return `<article class="comment ${depth ? "comment--reply" : ""}">
    <header><strong>${escapeHtml(comment.author)}</strong>${role}<span>${escapeHtml(meta)}</span></header>
    ${comment.text ? `<p>${escapeHtml(comment.text).replaceAll("\n", "<br>")}</p>` : ""}
    <div class="media-list">${renderHtmlMedia(comment.resources, localPathByUrl)}</div>
    ${replies ? `<div class="replies">${replies}</div>` : ""}
  </article>`;
}

export function buildHtml(data, localPathByUrl = new Map()) {
  const attachments = data.post.attachments.length
    ? data.post.attachments
        .map((attachment) => {
          const path = localPathByUrl.get(attachment.url);
          return path
            ? `<li><a href="${escapeHtml(path)}">${escapeHtml(attachment.name)}</a><span>${escapeHtml(formatBytes(attachment.size))}</span></li>`
            : `<li class="download-error">${escapeHtml(attachment.name)}（下载失败）</li>`;
        })
        .join("")
    : "<li>无附件</li>";
  const comments = data.comments.length
    ? data.comments.map((comment) => renderHtmlComment(comment, localPathByUrl)).join("")
    : "<p class=\"empty\">暂无评论</p>";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(data.post.title)}</title>
  <style>
    :root{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#202738;background:#f5f6f8}
    *{box-sizing:border-box}body{max-width:880px;margin:0 auto;padding:32px 20px 72px}main{background:#fff;border:1px solid #e8eaf0;border-radius:18px;padding:32px;box-shadow:0 12px 40px #18213a0d}
    h1{font-size:28px;line-height:1.35;margin:0 0 12px}.meta{color:#737d91;font-size:14px;line-height:1.8}.content{margin:26px 0;white-space:pre-wrap;font-size:16px;line-height:1.9}
    h2{margin-top:34px;padding-bottom:10px;border-bottom:1px solid #eceef3;font-size:19px}a{color:#2f6ce5;text-decoration:none}ul{padding-left:20px}li{margin:8px 0}li span{margin-left:8px;color:#8991a2;font-size:12px}
    .comment{padding:18px 0;border-bottom:1px solid #eef0f4}.comment header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.comment header span{color:#8a93a5;font-size:12px}.comment p{line-height:1.75;margin:10px 0 0}.comment--reply{margin-left:20px;padding:14px 16px;border:0;border-left:3px solid #e7ebf4;background:#f8f9fc}.role{padding:2px 7px;border-radius:999px;color:#866500!important;background:#fff0b3}
    .media-list{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.media img{display:block;max-width:240px;max-height:240px;border-radius:8px;border:1px solid #e4e7ed}.download-error{color:#b34141!important}.empty{color:#8991a2}@media(max-width:600px){body{padding:0}main{border:0;border-radius:0;padding:22px}h1{font-size:23px}}
  </style>
</head>
<body><main>
  <h1>${escapeHtml(data.post.title)}</h1>
  <div class="meta">社群：${escapeHtml(data.community.title)}<br>作者：${escapeHtml(data.post.author)} · ${escapeHtml(data.post.createdAt || data.post.displayTime)}${data.post.location ? ` · ${escapeHtml(data.post.location)}` : ""}<br>来源：<a href="${escapeHtml(data.sourceUrl)}">打开原帖</a></div>
  <section class="content">${escapeHtml(data.post.text || "（无文字正文）")}</section>
  <h2>附件</h2><ul>${attachments}</ul>
  <h2>评论</h2>${comments}
</main></body></html>`;
}

export function buildArchiveReadme(data, failedDownloads = []) {
  const lines = [
    "鹅圈子帖子导出包",
    "================",
    "",
    `帖子：${data.post.title}`,
    `来源：${data.sourceUrl}`,
    `导出：${data.exportedAt}`,
    "",
    "文件说明：",
    "- index.html：可直接用浏览器打开的阅读版",
    "- 帖子.md：Markdown 版正文与评论",
    "- post.json：结构化数据（不含隐藏的精确 IP 和内部用户标识）",
    "- files/：帖子附件",
    "- media/：帖子及评论中的图片、音频或视频",
  ];
  if (failedDownloads.length) {
    lines.push("", "下载失败：", ...failedDownloads.map((item) => `- ${item.url}：${item.error}`));
  }
  return `${lines.join("\n")}\n`;
}
