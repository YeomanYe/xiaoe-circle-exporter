// ==UserScript==
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

var XiaoeHelperUserscript = (() => {
  // src/export-format.js
  var ILLEGAL_FILENAME = /[<>:"/\\|?*\u0000-\u001f]/g;
  function sanitizeFilename(value, fallback = "\u9E45\u5708\u5B50\u5E16\u5B50") {
    const normalized = String(value || "").normalize("NFKC").replace(ILLEGAL_FILENAME, "_").replace(/\s+/g, " ").replace(/[. ]+$/g, "").trim();
    return (normalized || fallback).slice(0, 100);
  }
  function buildArchiveFilename(data) {
    const sourceTime = data.post?.createdAt || data.exportedAt;
    const timestamp = String(sourceTime || "").trim().replace(/[T\s]+/g, "-").replace(/[:.]/g, "-").replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 19);
    const title = sanitizeFilename(data.post?.title);
    return `${title}-${timestamp || "\u65F6\u95F4\u672A\u77E5"}.zip`;
  }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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
      if (localPath) lines.push(`${indent}- [\u5A92\u4F53\u6587\u4EF6](${encodeURI(localPath)})`);
      else lines.push(`${indent}- \u5A92\u4F53\u4E0B\u8F7D\u5931\u8D25\uFF1A${url}`);
    }
    return lines;
  }
  function renderMarkdownComment(comment, localPathByUrl, depth = 0) {
    const indent = "  ".repeat(depth);
    const role = comment.role ? ` \xB7 ${markdownText(comment.role)}` : "";
    const location2 = comment.location ? ` \xB7 ${markdownText(comment.location)}` : "";
    const time = markdownText(comment.createdAt || comment.displayTime || "\u65F6\u95F4\u672A\u77E5");
    const lines = [
      `${indent}- **${markdownText(comment.author)}${role}** \xB7 ${time}${location2}`
    ];
    if (comment.text) lines.push(`${indent}  ${markdownText(comment.text).replaceAll("\n", `
${indent}  `)}`);
    lines.push(...renderMarkdownResources(comment.resources, localPathByUrl, `${indent}  `));
    for (const reply of comment.replies || []) {
      lines.push(...renderMarkdownComment(reply, localPathByUrl, depth + 1));
    }
    return lines;
  }
  function buildMarkdown(data, localPathByUrl = /* @__PURE__ */ new Map()) {
    const { post, community, comments } = data;
    const lines = [
      `# ${markdownText(post.title)}`,
      "",
      `- \u793E\u7FA4\uFF1A${markdownText(community.title)}`,
      `- \u4F5C\u8005\uFF1A${markdownText(post.author)}`,
      `- \u65F6\u95F4\uFF1A${markdownText(post.createdAt || post.displayTime || "\u65F6\u95F4\u672A\u77E5")}`,
      `- IP \u5C5E\u5730\uFF1A${markdownText(post.location || "\u672A\u663E\u793A")}`,
      `- \u6765\u6E90\uFF1A${data.sourceUrl}`,
      `- \u5BFC\u51FA\u65F6\u95F4\uFF1A${data.exportedAt}`,
      "",
      "## \u6B63\u6587",
      "",
      post.text || "\uFF08\u65E0\u6587\u5B57\u6B63\u6587\uFF09",
      "",
      "## \u9644\u4EF6",
      ""
    ];
    if (post.attachments.length === 0) {
      lines.push("\uFF08\u65E0\u9644\u4EF6\uFF09");
    } else {
      for (const attachment of post.attachments) {
        const path = localPathByUrl.get(attachment.url);
        const size = formatBytes(attachment.size);
        lines.push(
          path ? `- [${markdownText(attachment.name)}](${encodeURI(path)})${size ? ` \xB7 ${size}` : ""}` : `- ${markdownText(attachment.name)} \xB7 \u4E0B\u8F7D\u5931\u8D25 \xB7 ${attachment.url}`
        );
      }
    }
    lines.push("", `## \u8BC4\u8BBA\uFF08${comments.length} \u6761\u4E00\u7EA7\u8BC4\u8BBA\uFF09`, "");
    if (comments.length === 0) lines.push("\uFF08\u6682\u65E0\u8BC4\u8BBA\uFF09");
    for (const comment of comments) lines.push(...renderMarkdownComment(comment, localPathByUrl));
    return `${lines.join("\n")}
`;
  }
  function renderHtmlMedia(urls, localPathByUrl) {
    return (urls || []).map((url) => {
      const path = localPathByUrl.get(url);
      return path ? `<a class="media" href="${escapeHtml(path)}"><img src="${escapeHtml(path)}" alt="\u8BC4\u8BBA\u5A92\u4F53" loading="lazy"></a>` : `<p class="download-error">\u5A92\u4F53\u4E0B\u8F7D\u5931\u8D25\uFF1A${escapeHtml(url)}</p>`;
    }).join("");
  }
  function renderHtmlComment(comment, localPathByUrl, depth = 0) {
    const role = comment.role ? `<span class="role">${escapeHtml(comment.role)}</span>` : "";
    const meta = [comment.createdAt || comment.displayTime, comment.location].filter(Boolean).join(" \xB7 ");
    const replies = (comment.replies || []).map((reply) => renderHtmlComment(reply, localPathByUrl, depth + 1)).join("");
    return `<article class="comment ${depth ? "comment--reply" : ""}">
    <header><strong>${escapeHtml(comment.author)}</strong>${role}<span>${escapeHtml(meta)}</span></header>
    ${comment.text ? `<p>${escapeHtml(comment.text).replaceAll("\n", "<br>")}</p>` : ""}
    <div class="media-list">${renderHtmlMedia(comment.resources, localPathByUrl)}</div>
    ${replies ? `<div class="replies">${replies}</div>` : ""}
  </article>`;
  }
  function buildHtml(data, localPathByUrl = /* @__PURE__ */ new Map()) {
    const attachments = data.post.attachments.length ? data.post.attachments.map((attachment) => {
      const path = localPathByUrl.get(attachment.url);
      return path ? `<li><a href="${escapeHtml(path)}">${escapeHtml(attachment.name)}</a><span>${escapeHtml(formatBytes(attachment.size))}</span></li>` : `<li class="download-error">${escapeHtml(attachment.name)}\uFF08\u4E0B\u8F7D\u5931\u8D25\uFF09</li>`;
    }).join("") : "<li>\u65E0\u9644\u4EF6</li>";
    const comments = data.comments.length ? data.comments.map((comment) => renderHtmlComment(comment, localPathByUrl)).join("") : '<p class="empty">\u6682\u65E0\u8BC4\u8BBA</p>';
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
  <div class="meta">\u793E\u7FA4\uFF1A${escapeHtml(data.community.title)}<br>\u4F5C\u8005\uFF1A${escapeHtml(data.post.author)} \xB7 ${escapeHtml(data.post.createdAt || data.post.displayTime)}${data.post.location ? ` \xB7 ${escapeHtml(data.post.location)}` : ""}<br>\u6765\u6E90\uFF1A<a href="${escapeHtml(data.sourceUrl)}">\u6253\u5F00\u539F\u5E16</a></div>
  <section class="content">${escapeHtml(data.post.text || "\uFF08\u65E0\u6587\u5B57\u6B63\u6587\uFF09")}</section>
  <h2>\u9644\u4EF6</h2><ul>${attachments}</ul>
  <h2>\u8BC4\u8BBA</h2>${comments}
</main></body></html>`;
  }
  function buildArchiveReadme(data, failedDownloads = []) {
    const lines = [
      "\u9E45\u5708\u5B50\u5E16\u5B50\u5BFC\u51FA\u5305",
      "================",
      "",
      `\u5E16\u5B50\uFF1A${data.post.title}`,
      `\u6765\u6E90\uFF1A${data.sourceUrl}`,
      `\u5BFC\u51FA\uFF1A${data.exportedAt}`,
      "",
      "\u6587\u4EF6\u8BF4\u660E\uFF1A",
      "- index.html\uFF1A\u53EF\u76F4\u63A5\u7528\u6D4F\u89C8\u5668\u6253\u5F00\u7684\u9605\u8BFB\u7248",
      "- \u5E16\u5B50.md\uFF1AMarkdown \u7248\u6B63\u6587\u4E0E\u8BC4\u8BBA",
      "- post.json\uFF1A\u7ED3\u6784\u5316\u6570\u636E\uFF08\u4E0D\u542B\u9690\u85CF\u7684\u7CBE\u786E IP \u548C\u5185\u90E8\u7528\u6237\u6807\u8BC6\uFF09",
      "- files/\uFF1A\u5E16\u5B50\u9644\u4EF6",
      "- media/\uFF1A\u5E16\u5B50\u53CA\u8BC4\u8BBA\u4E2D\u7684\u56FE\u7247\u3001\u97F3\u9891\u6216\u89C6\u9891"
    ];
    if (failedDownloads.length) {
      lines.push("", "\u4E0B\u8F7D\u5931\u8D25\uFF1A", ...failedDownloads.map((item) => `- ${item.url}\uFF1A${item.error}`));
    }
    return `${lines.join("\n")}
`;
  }

  // src/page-collector.js
  async function collectPostFromPage(options = {}) {
    const API_BASE = "/xe.community.community_service/small_community";
    const PAGE_SIZE = 10;
    const MAX_PAGES = 500;
    const currentUrl = new URL(options.url || globalThis.location.href);
    const requestOrigin = options.origin || currentUrl.origin;
    const requestFetch = options.fetch || globalThis.fetch;
    const documentTitle = options.documentTitle ?? globalThis.document?.title ?? "";
    if (currentUrl.pathname.includes("/sign_in")) {
      throw new Error("\u767B\u5F55\u72B6\u6001\u5DF2\u5931\u6548\uFF0C\u8BF7\u5148\u91CD\u65B0\u767B\u5F55\u9E45\u5708\u5B50\u3002");
    }
    const pathMatch = currentUrl.pathname.match(/^\/([^/]+)\/feed_detail/);
    const communityId = pathMatch?.[1];
    const feedsId = currentUrl.searchParams.get("feeds_id");
    const appId = currentUrl.searchParams.get("app_id");
    if (!communityId || !feedsId || !appId) {
      throw new Error("\u5F53\u524D\u4E0D\u662F\u6709\u6548\u7684\u9E45\u5708\u5B50\u5E16\u5B50\u8BE6\u60C5\u9875\u3002");
    }
    async function requestJson(endpoint, params) {
      const url = new URL(`${API_BASE}/${endpoint}`, requestOrigin);
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          for (const item of value) url.searchParams.append(`${key}[]`, item);
        } else if (value !== void 0 && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
      const response = await requestFetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`\u8BF7\u6C42\u5931\u8D25\uFF1A${response.status} ${endpoint}`);
      }
      const payload = await response.json();
      if (payload.code !== 0) {
        throw new Error(payload.msg || `\u9E45\u5708\u5B50\u63A5\u53E3\u8FD4\u56DE\u9519\u8BEF\uFF1A${endpoint}`);
      }
      return payload.data;
    }
    const detailData = await requestJson("h5_feeds_detail", {
      feeds_id: feedsId,
      community_id: communityId,
      app_id: appId,
      comment_order: "desc",
      page: 1,
      page_size: PAGE_SIZE,
      comment_order_filed: "created_at",
      reply_limit: 2
    });
    const feed = detailData.feedsDetail;
    if (!feed?.id) throw new Error("\u672A\u80FD\u8BFB\u53D6\u5E16\u5B50\u8BE6\u60C5\u3002");
    const topLevelComments = [];
    const seenCommentIds = /* @__PURE__ */ new Set();
    let totalTopLevelComments = 0;
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const relation = page === 1 ? ["comment", "praise"] : ["comment"];
      const pageData = await requestJson("get_comment_praise_list", {
        app_id: appId,
        community_id: communityId,
        feeds_id: feedsId,
        page,
        page_size: PAGE_SIZE,
        reply_limit: 2,
        order_type: 1,
        with_relation: relation
      });
      const commentList = pageData.comment_list || { list: [], total_count: 0 };
      const batch = Array.isArray(commentList.list) ? commentList.list : [];
      totalTopLevelComments = Number(commentList.total_count || 0);
      for (const comment of batch) {
        if (!seenCommentIds.has(comment.id)) {
          seenCommentIds.add(comment.id);
          topLevelComments.push(comment);
        }
      }
      if (topLevelComments.length >= totalTopLevelComments || batch.length === 0) break;
      if (page === MAX_PAGES) {
        throw new Error("\u8BC4\u8BBA\u6570\u91CF\u8D85\u8FC7\u5B89\u5168\u5206\u9875\u4E0A\u9650\uFF0C\u5BFC\u51FA\u5DF2\u505C\u6B62\u4EE5\u907F\u514D\u9057\u6F0F\u3002");
      }
    }
    for (const comment of topLevelComments) {
      const replyInfo = comment.reply_comment_list || { list: [], total_count: 0 };
      const replies = Array.isArray(replyInfo.list) ? [...replyInfo.list] : [];
      const replyIds = new Set(replies.map((reply) => reply.id));
      const replyTotal = Number(replyInfo.total_count || replies.length);
      for (let page = 1; replies.length < replyTotal && page <= MAX_PAGES; page += 1) {
        const replyData = await requestJson("reply_comment_list/1.0.0", {
          app_id: appId,
          community_id: communityId,
          feeds_id: feedsId,
          main_comment_id: comment.id,
          page,
          page_size: PAGE_SIZE,
          order_type: 3
        });
        const batch = Array.isArray(replyData.list) ? replyData.list : [];
        for (const reply of batch) {
          if (!replyIds.has(reply.id)) {
            replyIds.add(reply.id);
            replies.push(reply);
          }
        }
        if (batch.length === 0) break;
        if (page === MAX_PAGES) {
          throw new Error(`\u8BC4\u8BBA ${comment.id} \u7684\u56DE\u590D\u8D85\u8FC7\u5B89\u5168\u5206\u9875\u4E0A\u9650\u3002`);
        }
      }
      if (replies.length < replyTotal) {
        throw new Error(`\u8BC4\u8BBA ${comment.id} \u7684\u56DE\u590D\u672A\u80FD\u5B8C\u6574\u8BFB\u53D6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002`);
      }
      comment.reply_comment_list = { list: replies, total_count: replyTotal };
    }
    const resources = [];
    const resourceUrls = /* @__PURE__ */ new Set();
    function safeResourceName(value) {
      return typeof value === "string" && value.trim() ? value.trim() : "";
    }
    function addResource(candidate, kind, ownerId = "post") {
      if (!candidate) return "";
      const url = typeof candidate === "string" ? candidate : candidate.showUrl || candidate.url || candidate.src || candidate.file_url;
      if (typeof url !== "string" || !/^https?:\/\//i.test(url) || resourceUrls.has(url)) {
        return typeof url === "string" && /^https?:\/\//i.test(url) ? url : "";
      }
      resourceUrls.add(url);
      resources.push({
        url,
        kind,
        ownerId: String(ownerId),
        name: safeResourceName(candidate.name || candidate.file_name),
        mediaType: safeResourceName(candidate.type || candidate.fileType),
        expectedSize: Number(candidate.size || candidate.file_size || 0)
      });
      return url;
    }
    function scanResourceTree(value, kind, ownerId, seen = /* @__PURE__ */ new WeakSet(), collectedUrls = null) {
      if (!value) return;
      if (typeof value === "string") {
        const attributePattern = /(?:src|href)=["'](https?:\/\/[^"']+)["']/gi;
        for (const match of value.matchAll(attributePattern)) {
          const url = addResource(match[1], kind, ownerId);
          if (url) collectedUrls?.add(url);
        }
        if (/^https?:\/\//i.test(value)) {
          const url = addResource(value, kind, ownerId);
          if (url) collectedUrls?.add(url);
        }
        return;
      }
      if (typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (value.url || value.showUrl || value.src || value.file_url) {
        const url = addResource(value, kind, ownerId);
        if (url) collectedUrls?.add(url);
      }
      for (const child of Object.values(value)) {
        scanResourceTree(child, kind, ownerId, seen, collectedUrls);
      }
    }
    for (const file of Array.isArray(feed.file_json) ? feed.file_json : []) {
      addResource(file, "attachment", feed.id);
    }
    const postMediaFields = [
      feed.content,
      feed.mix_content,
      feed.org_content,
      feed.image_json,
      feed.video_json,
      feed.audio_json,
      feed.resource_json,
      feed.feed_tts_audio
    ];
    for (const field of postMediaFields) scanResourceTree(field, "post-media", feed.id);
    function normalizeComment(comment, isReply = false) {
      const commentResources = /* @__PURE__ */ new Set();
      scanResourceTree(
        comment.comment_resource,
        isReply ? "reply-media" : "comment-media",
        comment.id,
        /* @__PURE__ */ new WeakSet(),
        commentResources
      );
      const replies = Array.isArray(comment.reply_comment_list?.list) ? comment.reply_comment_list.list.map((reply) => normalizeComment(reply, true)) : [];
      return {
        id: String(comment.id),
        author: comment.nick_name || "\u533F\u540D\u7528\u6237",
        role: comment.role_name || "",
        text: comment.comment || "",
        createdAt: comment.created_at || "",
        displayTime: comment.show_time || "",
        location: comment.ip_place || "",
        likeCount: Number(comment.praise_cnt || comment.zan_num || 0),
        resources: [...commentResources],
        replies
      };
    }
    const comments = topLevelComments.map((comment) => normalizeComment(comment));
    const stripHtml = (html) => String(html || "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    const postText = feed.content?.text || feed.mix_content?.text || stripHtml(feed.org_content) || "";
    const canonicalUrl = new URL(`/${communityId}/feed_detail`, currentUrl.origin);
    canonicalUrl.searchParams.set("feeds_id", feedsId);
    canonicalUrl.searchParams.set("app_id", appId);
    return {
      schemaVersion: 1,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      sourceUrl: canonicalUrl.href,
      community: {
        id: communityId,
        title: feed.community_title || documentTitle.split(" - ").at(-1) || "\u9E45\u5708\u5B50"
      },
      post: {
        id: String(feed.id),
        title: feed.title || postText.split(/\r?\n/).find(Boolean) || `\u5E16\u5B50-${feed.id}`,
        text: postText,
        author: feed.nick_name || "\u533F\u540D\u7528\u6237",
        createdAt: feed.created_at || "",
        displayTime: feed.show_time || "",
        location: feed.ip_place || "",
        likeCount: Number(feed.zan_num || 0),
        commentCount: Number(feed.comment_count || 0),
        tags: Array.isArray(feed.tags) ? feed.tags : [],
        attachments: (Array.isArray(feed.file_json) ? feed.file_json : []).map((file) => ({
          name: file.name || file.file_name || "\u9644\u4EF6",
          url: file.showUrl || file.url || file.file_url || "",
          size: Number(file.size || file.file_size || 0),
          type: file.fileType || file.type || ""
        }))
      },
      comments,
      resources
    };
  }

  // src/userscript.js
  var BUTTON_CLASS = "xiaoe-circle-export-button";
  var HOST_CLASS = "xiaoe-circle-export-host";
  var STYLE_ID = "xiaoe-circle-export-style";
  var MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;
  var MIME_EXTENSIONS = /* @__PURE__ */ new Map([
    ["application/pdf", ".pdf"],
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/gif", ".gif"],
    ["image/webp", ".webp"],
    ["audio/mpeg", ".mp3"],
    ["audio/mp4", ".m4a"],
    ["video/mp4", ".mp4"]
  ]);
  var { strToU8, zipSync } = globalThis.fflate || {};
  if (typeof strToU8 !== "function" || typeof zipSync !== "function") {
    throw new Error("\u5C0F\u9E45\u901A\u52A9\u624B\u4F9D\u8D56 fflate\uFF0C\u8BF7\u786E\u8BA4\u7528\u6237\u811A\u672C\u7BA1\u7406\u5668\u5141\u8BB8\u52A0\u8F7D @require\u3002");
  }
  var scanScheduled = false;
  installStyles();
  scanPage();
  var observer = new MutationObserver(scheduleScan);
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
    button.textContent = "\u6253\u5305\u4E0B\u8F7D";
    button.title = "\u4E0B\u8F7D\u6B63\u6587\u3001\u9644\u4EF6\u548C\u5B8C\u6574\u8BC4\u8BBA";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      button.textContent = "\u6253\u5305\u4E2D\u2026";
      showToast("\u6B63\u5728\u8BFB\u53D6\u5E16\u5B50\u8BE6\u60C5\u2026", "working");
      try {
        const data = await collectPostFromPage({
          url: detailUrl,
          documentTitle: document.title
        });
        const archive = await buildArchive(data, (message) => showToast(message, "working"));
        saveArchive(archive.blob, archive.filename);
        showToast(`\u4E0B\u8F7D\u5DF2\u5F00\u59CB\uFF1A${archive.filename}`, "done");
        button.textContent = "\u6253\u5305\u4E0B\u8F7D";
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error), "error");
        button.textContent = "\u91CD\u65B0\u6253\u5305";
      } finally {
        button.disabled = false;
      }
    });
    card.append(button);
  }
  async function buildArchive(data, progress) {
    const entries = {};
    const localPathByUrl = /* @__PURE__ */ new Map();
    const usedPaths = /* @__PURE__ */ new Set();
    const failures = [];
    let totalBytes = 0;
    for (let index = 0; index < data.resources.length; index += 1) {
      const resource = data.resources[index];
      progress(`\u6B63\u5728\u4E0B\u8F7D\u6587\u4EF6 ${index + 1}/${data.resources.length}\u2026`);
      try {
        const response = await downloadResource(resource.url);
        const bytes = new Uint8Array(response.arrayBuffer);
        totalBytes += bytes.byteLength;
        if (totalBytes > MAX_ARCHIVE_BYTES) {
          throw new Error("\u9644\u4EF6\u603B\u5927\u5C0F\u8D85\u8FC7 500 MB \u7684\u5B89\u5168\u4E0A\u9650\u3002");
        }
        const path = makeResourcePath(resource, index, response.contentType, usedPaths);
        entries[path] = bytes;
        localPathByUrl.set(resource.url, path);
      } catch (error) {
        failures.push({
          url: resource.url,
          kind: resource.kind,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    if (failures.length) {
      const firstFailure = failures[0];
      throw new Error(
        `\u6709 ${failures.length} \u4E2A\u6587\u4EF6\u4E0B\u8F7D\u5931\u8D25\uFF0C\u5DF2\u505C\u6B62\u5BFC\u51FA\u4EE5\u907F\u514D\u751F\u6210\u4E0D\u5B8C\u6574\u538B\u7F29\u5305\uFF1A${firstFailure.error}`
      );
    }
    entries["index.html"] = strToU8(buildHtml(data, localPathByUrl));
    entries["\u5E16\u5B50.md"] = strToU8(buildMarkdown(data, localPathByUrl));
    entries["post.json"] = strToU8(
      `${JSON.stringify({ ...data, resources: data.resources.map((item) => ({ ...item, localPath: localPathByUrl.get(item.url) })) }, null, 2)}
`
    );
    entries["README.txt"] = strToU8(buildArchiveReadme(data, failures));
    progress("\u6B63\u5728\u751F\u6210 ZIP \u538B\u7F29\u5305\u2026");
    const zipped = zipSync(entries, { level: 0 });
    return {
      blob: new Blob([zipped], { type: "application/zip" }),
      filename: buildArchiveFilename(data)
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
            contentType: getResponseHeader(response, "content-type")
          });
        },
        onerror() {
          reject(new Error("\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25"));
        },
        ontimeout() {
          reject(new Error("\u7F51\u7EDC\u8BF7\u6C42\u8D85\u65F6"));
        }
      });
    });
  }
  async function fetchResource(url) {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return {
      arrayBuffer: await response.arrayBuffer(),
      contentType: response.headers.get("content-type")?.split(";")[0] || ""
    };
  }
  function getResponseHeader(response, name) {
    const headers = String(response.responseHeaders || "");
    const match = headers.split(/\r?\n/).map((line) => line.split(":")).find(([key]) => key?.trim().toLowerCase() === name);
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
    name = sanitizeFilename(name || `\u8D44\u6E90-${index + 1}`, `\u8D44\u6E90-${index + 1}`);
    if (!/\.[a-z0-9]{1,8}$/i.test(name)) name += MIME_EXTENSIONS.get(contentType) || "";
    const directory = resource.kind === "attachment" ? "files" : resource.kind === "post-media" ? "media/post" : `media/comments/${sanitizeFilename(resource.ownerId, "unknown")}`;
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
    setTimeout(() => URL.revokeObjectURL(url), 6e4);
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
      }, 6e3);
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
})();
