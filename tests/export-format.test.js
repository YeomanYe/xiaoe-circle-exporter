import assert from "node:assert/strict";
import test from "node:test";
import { buildHtml, buildMarkdown, sanitizeFilename } from "../src/export-format.js";

const fixture = {
  exportedAt: "2026-08-12T10:00:00.000Z",
  sourceUrl: "https://quanzi.xiaoe-tech.com/community/feed_detail?feeds_id=1&app_id=2",
  community: { title: "里海的朋友们的社群" },
  post: {
    title: "请帮忙看下 <投资价值>",
    text: "正文第一行\n正文第二行",
    author: "作者",
    createdAt: "2026-08-10 12:21:50",
    displayTime: "",
    location: "云南",
    attachments: [{ name: "报告.pdf", url: "https://cdn/report.pdf", size: 1024 }],
  },
  comments: [
    {
      author: "评论者",
      role: "圈主",
      text: "<script>alert(1)</script>",
      createdAt: "2026-08-10 21:49:29",
      displayTime: "",
      location: "浙江",
      resources: ["https://cdn/comment.jpg"],
      replies: [],
    },
  ],
};

test("sanitizes archive filenames", () => {
  assert.equal(sanitizeFilename('a/b:c*?"<d>|'), "a_b_c____d__");
});

test("renders local attachment and media paths and escapes untrusted HTML", () => {
  const paths = new Map([
    ["https://cdn/report.pdf", "files/报告.pdf"],
    ["https://cdn/comment.jpg", "media/comments/1/图.jpg"],
  ]);
  const markdown = buildMarkdown(fixture, paths);
  const html = buildHtml(fixture, paths);

  assert.match(decodeURI(markdown), /files\/报告\.pdf/);
  assert.match(decodeURI(markdown), /media\/comments\/1\/图\.jpg/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
