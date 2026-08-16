export async function collectPostFromPage(options = {}) {
  const API_BASE =
    "/xe.community.community_service/small_community";
  const PAGE_SIZE = 10;
  const MAX_PAGES = 500;

  const currentUrl = new URL(options.url || globalThis.location.href);
  const requestOrigin = options.origin || currentUrl.origin;
  const requestFetch = options.fetch || globalThis.fetch;
  const documentTitle = options.documentTitle ?? globalThis.document?.title ?? "";

  if (currentUrl.pathname.includes("/sign_in")) {
    throw new Error("登录状态已失效，请先重新登录鹅圈子。");
  }

  const pathMatch = currentUrl.pathname.match(/^\/([^/]+)\/feed_detail/);
  const communityId = pathMatch?.[1];
  const feedsId = currentUrl.searchParams.get("feeds_id");
  const appId = currentUrl.searchParams.get("app_id");

  if (!communityId || !feedsId || !appId) {
    throw new Error("当前不是有效的鹅圈子帖子详情页。");
  }

  async function requestJson(endpoint, params) {
    const url = new URL(`${API_BASE}/${endpoint}`, requestOrigin);
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(`${key}[]`, item);
      } else if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await requestFetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`请求失败：${response.status} ${endpoint}`);
    }

    const payload = await response.json();
    if (payload.code !== 0) {
      throw new Error(payload.msg || `鹅圈子接口返回错误：${endpoint}`);
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
    reply_limit: 2,
  });

  const feed = detailData.feedsDetail;
  if (!feed?.id) throw new Error("未能读取帖子详情。");

  const topLevelComments = [];
  const seenCommentIds = new Set();
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
      with_relation: relation,
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
      throw new Error("评论数量超过安全分页上限，导出已停止以避免遗漏。");
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
        order_type: 3,
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
        throw new Error(`评论 ${comment.id} 的回复超过安全分页上限。`);
      }
    }

    if (replies.length < replyTotal) {
      throw new Error(`评论 ${comment.id} 的回复未能完整读取，请稍后重试。`);
    }

    comment.reply_comment_list = { list: replies, total_count: replyTotal };
  }

  const resources = [];
  const resourceUrls = new Set();

  function safeResourceName(value) {
    return typeof value === "string" && value.trim() ? value.trim() : "";
  }

  function addResource(candidate, kind, ownerId = "post") {
    if (!candidate) return "";
    const url =
      typeof candidate === "string"
        ? candidate
        : candidate.showUrl || candidate.url || candidate.src || candidate.file_url;
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
      expectedSize: Number(candidate.size || candidate.file_size || 0),
    });
    return url;
  }

  function scanResourceTree(
    value,
    kind,
    ownerId,
    seen = new WeakSet(),
    collectedUrls = null,
  ) {
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
    feed.feed_tts_audio,
  ];
  for (const field of postMediaFields) scanResourceTree(field, "post-media", feed.id);

  function normalizeComment(comment, isReply = false) {
    const commentResources = new Set();
    scanResourceTree(
      comment.comment_resource,
      isReply ? "reply-media" : "comment-media",
      comment.id,
      new WeakSet(),
      commentResources,
    );

    const replies = Array.isArray(comment.reply_comment_list?.list)
      ? comment.reply_comment_list.list.map((reply) => normalizeComment(reply, true))
      : [];

    return {
      id: String(comment.id),
      author: comment.nick_name || "匿名用户",
      role: comment.role_name || "",
      text: comment.comment || "",
      createdAt: comment.created_at || "",
      displayTime: comment.show_time || "",
      location: comment.ip_place || "",
      likeCount: Number(comment.praise_cnt || comment.zan_num || 0),
      resources: [...commentResources],
      replies,
    };
  }

  const comments = topLevelComments.map((comment) => normalizeComment(comment));
  const stripHtml = (html) =>
    String(html || "")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
  const postText =
    feed.content?.text || feed.mix_content?.text || stripHtml(feed.org_content) || "";
  const canonicalUrl = new URL(`/${communityId}/feed_detail`, currentUrl.origin);
  canonicalUrl.searchParams.set("feeds_id", feedsId);
  canonicalUrl.searchParams.set("app_id", appId);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    sourceUrl: canonicalUrl.href,
    community: {
      id: communityId,
      title: feed.community_title || documentTitle.split(" - ").at(-1) || "鹅圈子",
    },
    post: {
      id: String(feed.id),
      title: feed.title || postText.split(/\r?\n/).find(Boolean) || `帖子-${feed.id}`,
      text: postText,
      author: feed.nick_name || "匿名用户",
      createdAt: feed.created_at || "",
      displayTime: feed.show_time || "",
      location: feed.ip_place || "",
      likeCount: Number(feed.zan_num || 0),
      commentCount: Number(feed.comment_count || 0),
      tags: Array.isArray(feed.tags) ? feed.tags : [],
      attachments: (Array.isArray(feed.file_json) ? feed.file_json : []).map((file) => ({
        name: file.name || file.file_name || "附件",
        url: file.showUrl || file.url || file.file_url || "",
        size: Number(file.size || file.file_size || 0),
        type: file.fileType || file.type || "",
      })),
    },
    comments,
    resources,
  };
}
