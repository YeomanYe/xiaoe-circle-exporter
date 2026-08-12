import assert from "node:assert/strict";
import test from "node:test";
import { collectPostFromPage } from "../src/page-collector.js";

test("collects paginated comments, replies and media without hidden identity fields", async () => {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  const originalDocument = globalThis.document;
  const requestedUrls = [];

  globalThis.location = new URL(
    "https://quanzi.xiaoe-tech.com/community-demo/feed_detail?feeds_id=feed-1&app_id=app-1",
  );
  globalThis.document = { title: "测试帖子 - 测试社群" };
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    requestedUrls.push(url);
    let data;

    if (url.pathname.endsWith("/h5_feeds_detail")) {
      data = {
        feedsDetail: {
          id: "feed-1",
          community_title: "测试社群",
          title: "测试帖子",
          nick_name: "作者",
          created_at: "2026-08-12 10:00:00",
          ip: "127.0.0.1",
          ip_place: "上海",
          zan_num: 2,
          comment_count: 4,
          tags: [],
          content: { text: "正文" },
          file_json: [
            { name: "报告.pdf", url: "https://cdn.myqcloud.com/report.pdf", size: 12 },
          ],
        },
      };
    } else if (url.pathname.endsWith("/get_comment_praise_list")) {
      const page = Number(url.searchParams.get("page"));
      data = {
        comment_list: {
          total_count: 2,
          list:
            page === 1
              ? [
                  {
                    id: 1,
                    nick_name: "评论者甲",
                    user_id: "hidden-user-id",
                    ip: "10.0.0.1",
                    ip_place: "浙江",
                    comment: "一级评论",
                    comment_resource: {
                      image: [
                        { name: "图.jpg", url: "https://cdn.myqcloud.com/comment.jpg" },
                        { name: "重复图.jpg", url: "https://cdn.myqcloud.com/shared.jpg" },
                      ],
                    },
                    reply_comment_list: {
                      total_count: 2,
                      list: [{ id: 11, nick_name: "回复者甲", comment: "回复一" }],
                    },
                  },
                ]
              : [
                  {
                    id: 2,
                    nick_name: "评论者乙",
                    comment: "第二条",
                    comment_resource: {
                      image: [{ name: "重复图.jpg", url: "https://cdn.myqcloud.com/shared.jpg" }],
                    },
                    reply_comment_list: { total_count: 0, list: [] },
                  },
                ],
        },
      };
    } else if (url.pathname.endsWith("/reply_comment_list/1.0.0")) {
      data = {
        total_count: 2,
        list: [
          { id: 11, nick_name: "回复者甲", comment: "回复一" },
          { id: 12, nick_name: "回复者乙", comment: "回复二", ip: "10.0.0.2" },
        ],
      };
    } else {
      throw new Error(`Unexpected URL: ${url}`);
    }

    return new Response(JSON.stringify({ code: 0, msg: "success", data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await collectPostFromPage();
    assert.equal(result.post.title, "测试帖子");
    assert.equal(result.comments.length, 2);
    assert.equal(result.comments[0].replies.length, 2);
    assert.equal(result.resources.length, 3);
    assert.deepEqual(result.comments[1].resources, ["https://cdn.myqcloud.com/shared.jpg"]);
    assert.equal("ip" in result.comments[0], false);
    assert.equal("user_id" in result.comments[0], false);
    assert.equal(
      requestedUrls.some(
        (url) => url.pathname.endsWith("/get_comment_praise_list") && url.searchParams.get("page") === "2",
      ),
      true,
    );
    assert.equal(
      requestedUrls.some((url) => url.pathname.endsWith("/reply_comment_list/1.0.0")),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.location = originalLocation;
    globalThis.document = originalDocument;
  }
});
