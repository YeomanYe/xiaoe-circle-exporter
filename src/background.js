import { collectPostFromPage } from "./page-collector.js";

const jobs = new Map();
const DETAIL_PATH = /\/feed_detail(?:$|[/?])/;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "XIAOE_ARCHIVE_PROGRESS") {
    const job = jobs.get(message.jobId);
    if (job) broadcastProgress(job, message);
    return undefined;
  }

  if (message?.type !== "XIAOE_EXPORT_REQUEST") return undefined;

  runExport(message, sender)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => {
      const sourceTabId = sender.tab?.id ?? message.tabId;
      notifyTab(sourceTabId, {
        type: "XIAOE_EXPORT_PROGRESS",
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
  return true;
});

async function runExport(message, sender) {
  const sourceTabId = sender.tab?.id ?? message.tabId;
  if (!Number.isInteger(sourceTabId)) throw new Error("无法识别当前标签页。");

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
      message: "正在打开帖子详情并读取全部评论…",
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
      func: collectPostFromPage,
    });
    const result = injectionResults[0]?.result;
    if (!result) throw new Error("页面没有返回帖子数据，请刷新后重试。");

    broadcastProgress(job, {
      state: "working",
      message: `已读取 ${countComments(result.comments)} 条评论，正在下载 ${result.resources.length} 个文件…`,
    });

    await ensureOffscreenDocument();
    const archiveResult = await chrome.runtime.sendMessage({
      type: "XIAOE_BUILD_ARCHIVE",
      jobId,
      payload: result,
    });
    if (!archiveResult?.ok) throw new Error(archiveResult?.error || "压缩包生成失败。");

    const downloadId = await chrome.downloads.download({
      url: archiveResult.blobUrl,
      filename: archiveResult.filename,
      saveAs: false,
      conflictAction: "uniquify",
    });

    broadcastProgress(job, {
      state: "done",
      message: `下载已开始：${archiveResult.filename}`,
    });
    return {
      filename: archiveResult.filename,
      resourceCount: archiveResult.resourceCount,
      downloadId,
    };
  } finally {
    jobs.delete(jobId);
    if (temporaryTabId) {
      await chrome.tabs.remove(temporaryTabId).catch(() => undefined);
    }
  }
}

function normalizeDetailUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("帖子详情地址无效。");
  }
  if (url.protocol !== "https:" || url.hostname !== "quanzi.xiaoe-tech.com") {
    throw new Error("仅支持 quanzi.xiaoe-tech.com 的帖子。");
  }
  if (!DETAIL_PATH.test(url.pathname) || !url.searchParams.get("feeds_id")) {
    throw new Error("请在帖子详情页导出，或点击帖子卡片上的“打包下载”。");
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
      reject(new Error("帖子详情页加载超时。"));
    }, 30_000);

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
      documentUrls: [documentUrl],
    });
    if (contexts.length) return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["BLOBS"],
      justification: "在本机生成帖子 ZIP 压缩包并触发下载。",
    });
  } catch (error) {
    if (!String(error).includes("Only a single offscreen document")) throw error;
  }
}

function broadcastProgress(job, progress) {
  const message = { type: "XIAOE_EXPORT_PROGRESS", jobId: job.jobId, ...progress };
  notifyTab(job.sourceTabId, message);
  chrome.runtime.sendMessage(message).catch(() => undefined);
}

function notifyTab(tabId, message) {
  if (!Number.isInteger(tabId)) return;
  chrome.tabs.sendMessage(tabId, message).catch(() => undefined);
}

function countComments(comments) {
  return (comments || []).reduce(
    (total, comment) => total + 1 + countComments(comment.replies),
    0,
  );
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
