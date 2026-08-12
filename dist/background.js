(() => {
  // src/page-collector.js
  async function collectPostFromPage() {
    const API_BASE = "/xe.community.community_service/small_community";
    const PAGE_SIZE = 10;
    const MAX_PAGES = 500;
    const currentUrl = new URL(location.href);
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
      const url = new URL(`${API_BASE}/${endpoint}`, location.origin);
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          for (const item of value) url.searchParams.append(`${key}[]`, item);
        } else if (value !== void 0 && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
      const response = await fetch(url, { credentials: "include" });
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
    const canonicalUrl = new URL(`/${communityId}/feed_detail`, location.origin);
    canonicalUrl.searchParams.set("feeds_id", feedsId);
    canonicalUrl.searchParams.set("app_id", appId);
    return {
      schemaVersion: 1,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      sourceUrl: canonicalUrl.href,
      community: {
        id: communityId,
        title: feed.community_title || document.title.split(" - ").at(-1) || "\u9E45\u5708\u5B50"
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

  // src/background.js
  var jobs = /* @__PURE__ */ new Map();
  var DETAIL_PATH = /\/feed_detail(?:$|[/?])/;
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "XIAOE_ARCHIVE_PROGRESS") {
      const job = jobs.get(message.jobId);
      if (job) broadcastProgress(job, message);
      return void 0;
    }
    if (message?.type !== "XIAOE_EXPORT_REQUEST") return void 0;
    runExport(message, sender).then((result) => sendResponse({ ok: true, ...result })).catch((error) => {
      const sourceTabId = sender.tab?.id ?? message.tabId;
      notifyTab(sourceTabId, {
        type: "XIAOE_EXPORT_PROGRESS",
        state: "error",
        message: error instanceof Error ? error.message : String(error)
      });
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
    return true;
  });
  async function runExport(message, sender) {
    const sourceTabId = sender.tab?.id ?? message.tabId;
    if (!Number.isInteger(sourceTabId)) throw new Error("\u65E0\u6CD5\u8BC6\u522B\u5F53\u524D\u6807\u7B7E\u9875\u3002");
    const sourceTab = await chrome.tabs.get(sourceTabId);
    const detailUrl = normalizeDetailUrl(message.detailUrl || sourceTab.url);
    const jobId = crypto.randomUUID();
    const job = { jobId, sourceTabId };
    jobs.set(jobId, job);
    let workingTabId = sourceTabId;
    let temporaryTabId = null;
    try {
      broadcastProgress(job, {
        state: "working",
        message: "\u6B63\u5728\u6253\u5F00\u5E16\u5B50\u8BE6\u60C5\u5E76\u8BFB\u53D6\u5168\u90E8\u8BC4\u8BBA\u2026"
      });
      if (!DETAIL_PATH.test(new URL(sourceTab.url).pathname) || sourceTab.url !== detailUrl) {
        const temporaryTab = await chrome.tabs.create({ url: detailUrl, active: false });
        temporaryTabId = temporaryTab.id;
        workingTabId = temporaryTab.id;
      }
      await waitForTabReady(workingTabId);
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: workingTabId },
        world: "MAIN",
        func: collectPostFromPage
      });
      const result = injectionResults[0]?.result;
      if (!result) throw new Error("\u9875\u9762\u6CA1\u6709\u8FD4\u56DE\u5E16\u5B50\u6570\u636E\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002");
      broadcastProgress(job, {
        state: "working",
        message: `\u5DF2\u8BFB\u53D6 ${countComments(result.comments)} \u6761\u8BC4\u8BBA\uFF0C\u6B63\u5728\u4E0B\u8F7D ${result.resources.length} \u4E2A\u6587\u4EF6\u2026`
      });
      await ensureOffscreenDocument();
      const archiveResult = await chrome.runtime.sendMessage({
        type: "XIAOE_BUILD_ARCHIVE",
        jobId,
        payload: result
      });
      if (!archiveResult?.ok) throw new Error(archiveResult?.error || "\u538B\u7F29\u5305\u751F\u6210\u5931\u8D25\u3002");
      const downloadId = await chrome.downloads.download({
        url: archiveResult.blobUrl,
        filename: archiveResult.filename,
        saveAs: false,
        conflictAction: "uniquify"
      });
      broadcastProgress(job, {
        state: "done",
        message: `\u4E0B\u8F7D\u5DF2\u5F00\u59CB\uFF1A${archiveResult.filename}`
      });
      return {
        filename: archiveResult.filename,
        resourceCount: archiveResult.resourceCount,
        downloadId
      };
    } finally {
      jobs.delete(jobId);
      if (temporaryTabId) {
        await chrome.tabs.remove(temporaryTabId).catch(() => void 0);
      }
    }
  }
  function normalizeDetailUrl(value) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error("\u5E16\u5B50\u8BE6\u60C5\u5730\u5740\u65E0\u6548\u3002");
    }
    if (url.protocol !== "https:" || url.hostname !== "quanzi.xiaoe-tech.com") {
      throw new Error("\u4EC5\u652F\u6301 quanzi.xiaoe-tech.com \u7684\u5E16\u5B50\u3002");
    }
    if (!DETAIL_PATH.test(url.pathname) || !url.searchParams.get("feeds_id")) {
      throw new Error("\u8BF7\u5728\u5E16\u5B50\u8BE6\u60C5\u9875\u5BFC\u51FA\uFF0C\u6216\u70B9\u51FB\u5E16\u5B50\u5361\u7247\u4E0A\u7684\u201C\u6253\u5305\u4E0B\u8F7D\u201D\u3002");
    }
    url.hash = "";
    return url.href;
  }
  async function waitForTabReady(tabId) {
    const existing = await chrome.tabs.get(tabId);
    if (existing.status === "complete") {
      await delay(500);
      return;
    }
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error("\u5E16\u5B50\u8BE6\u60C5\u9875\u52A0\u8F7D\u8D85\u65F6\u3002"));
      }, 3e4);
      function listener(updatedTabId, changeInfo) {
        if (updatedTabId === tabId && changeInfo.status === "complete") {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
    await delay(500);
  }
  async function ensureOffscreenDocument() {
    const documentUrl = chrome.runtime.getURL("offscreen.html");
    if (chrome.runtime.getContexts) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [documentUrl]
      });
      if (contexts.length) return;
    }
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["BLOBS"],
        justification: "\u5728\u672C\u673A\u751F\u6210\u5E16\u5B50 ZIP \u538B\u7F29\u5305\u5E76\u89E6\u53D1\u4E0B\u8F7D\u3002"
      });
    } catch (error) {
      if (!String(error).includes("Only a single offscreen document")) throw error;
    }
  }
  function broadcastProgress(job, progress) {
    const message = { type: "XIAOE_EXPORT_PROGRESS", jobId: job.jobId, ...progress };
    notifyTab(job.sourceTabId, message);
    chrome.runtime.sendMessage(message).catch(() => void 0);
  }
  function notifyTab(tabId, message) {
    if (!Number.isInteger(tabId)) return;
    chrome.tabs.sendMessage(tabId, message).catch(() => void 0);
  }
  function countComments(comments) {
    return (comments || []).reduce(
      (total, comment) => total + 1 + countComments(comment.replies),
      0
    );
  }
  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
})();
