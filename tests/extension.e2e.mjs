import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "fflate";
import { chromium } from "playwright-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executablePath =
  process.env.CHROME_EXECUTABLE ||
  path.join(
    os.homedir(),
    "Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  );
const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "xiaoe-extension-e2e-profile-"));
const downloadsDirectory = await mkdtemp(path.join(os.tmpdir(), "xiaoe-extension-e2e-downloads-"));

const publicPdfUrl =
  "https://commonresource-1252524126.cdn.xiaoeknow.com/image/l524d18s0z0z.png";
const publicImageUrl =
  "https://commonresource-1252524126.cdn.xiaoeknow.com/image/lje2ym790wxo.png";

const context = await chromium.launchPersistentContext(profileDirectory, {
  executablePath,
  headless: false,
  acceptDownloads: true,
  ignoreDefaultArgs: ["--disable-extensions"],
  args: [
    `--disable-extensions-except=${path.join(root, "dist")}`,
    `--load-extension=${path.join(root, "dist")}`,
  ],
});

context.on("serviceworker", (worker) => {
  worker.on("console", (message) => console.log(`[service-worker:${message.type()}] ${message.text()}`));
});

try {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.href === publicPdfUrl || url.href === publicImageUrl) {
      await route.continue();
      return;
    }
    if (url.pathname.endsWith("/h5_feeds_detail")) {
      await json(route, {
        feedsDetail: {
          id: "feed-e2e",
          community_title: "测试社群",
          title: "插件端到端测试",
          nick_name: "测试作者",
          created_at: "2026-08-12 10:00:00",
          ip_place: "上海",
          zan_num: 1,
          comment_count: 1,
          tags: [],
          content: { text: "这是测试正文。" },
          file_json: [
            {
              name: "报告.pdf",
              url: publicPdfUrl,
              size: 344565,
              fileType: "pdf",
            },
          ],
        },
      });
      return;
    }
    if (url.pathname.endsWith("/get_comment_praise_list")) {
      await json(route, {
        praise_list: { list: [], total_count: 0 },
        comment_list: {
          total_count: 1,
          list: [
            {
              id: 101,
              nick_name: "测试评论者",
              comment: "这是完整评论。",
              created_at: "2026-08-12 10:01:00",
              ip_place: "浙江",
              comment_resource: {
                image: [
                  {
                    name: "评论图片.png",
                    url: publicImageUrl,
                  },
                ],
              },
              reply_comment_list: { list: [], total_count: 0 },
            },
          ],
        },
      });
      return;
    }
    if (url.hostname === "quanzi.xiaoe-tech.com" && url.pathname.endsWith("/feed_detail")) {
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html><head><title>插件端到端测试 - 测试社群</title></head><body>
          <style>
            .feed-item-wrapper { width: 640px; height: 260px; }
            .feed-base-wrapper { width: 100%; height: 100%; }
            .interactive-bar { position: absolute; right: 16px; bottom: 16px; }
            .to-feed-detail { display: block; width: 88px; height: 30px; }
          </style>
          <div class="feed-item-wrapper"><div class="feed-base-wrapper">
            <p>这是测试正文。</p>
            <div class="interactive-bar"><a class="to-feed-detail">查看详情</a></div>
          </div></div>
        </body></html>`,
      });
      return;
    }
    await route.abort();
  });

  const page = await context.newPage();
  page.on("console", (message) => console.log(`[page:${message.type()}] ${message.text()}`));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadsDirectory,
    eventsEnabled: true,
  });

  await page.goto(
    "https://quanzi.xiaoe-tech.com/community-e2e/feed_detail?feeds_id=feed-e2e&app_id=app-e2e",
  );
  const exportButton = page.getByRole("button", { name: "打包下载" });
  await exportButton.waitFor({ state: "visible" });
  const cardBox = await page.locator(".feed-item-wrapper").boundingBox();
  const buttonBox = await exportButton.boundingBox();
  const detailBox = await page.locator(".to-feed-detail").boundingBox();
  assert.ok(cardBox && buttonBox && detailBox);
  assert.ok(buttonBox.y - cardBox.y <= 20, "导出按钮应位于帖子卡片顶部");
  assert.ok(cardBox.x + cardBox.width - (buttonBox.x + buttonBox.width) <= 20, "导出按钮应靠右");
  assert.equal(rectanglesOverlap(buttonBox, detailBox), false, "导出按钮不得遮挡查看详情");
  await exportButton.click();
  const toast = page.locator("#xiaoe-circle-export-toast");
  await toast.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const state = document.getElementById("xiaoe-circle-export-toast")?.dataset.state;
    return state === "done" || state === "error";
  }, null, { timeout: 30_000 });
  const toastState = await toast.getAttribute("data-state");
  const toastText = await toast.textContent();
  assert.equal(toastState, "done", toastText || "导出未完成");

  const zipPath = await waitForZip(downloadsDirectory);
  const archive = unzipSync(new Uint8Array(await readFile(zipPath)));
  assert.ok(archive["index.html"]);
  assert.ok(archive["帖子.md"]);
  assert.ok(archive["post.json"]);
  assert.ok(archive["files/报告.pdf"]);
  assert.ok(archive["media/comments/101/评论图片.png"]);
  assert.match(strFromU8(archive["帖子.md"]), /这是完整评论/);
  console.log(`E2E export verified: ${path.basename(zipPath)}`);
} finally {
  await context.close();
  await rm(profileDirectory, { recursive: true, force: true });
  await rm(downloadsDirectory, { recursive: true, force: true });
}

async function json(route, data) {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ code: 0, msg: "success", data }),
  });
}

async function waitForZip(directory) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const names = await readdir(directory);
    const completeZip = names.find((name) => name.endsWith(".zip"));
    if (completeZip) return path.join(directory, completeZip);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Timed out waiting for ZIP download");
}

function rectanglesOverlap(first, second) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}
