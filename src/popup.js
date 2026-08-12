const statusElement = document.getElementById("status");
const statusDot = document.getElementById("status-dot");
const exportButton = document.getElementById("export");
const hintElement = document.getElementById("hint");

let activeTab;
initialize();

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "XIAOE_EXPORT_PROGRESS") return;
  setStatus(message.message, message.state);
  exportButton.disabled = message.state === "working";
  if (message.state === "done") exportButton.textContent = "已开始下载";
  if (message.state === "error") exportButton.textContent = "重新打包";
});

exportButton.addEventListener("click", async () => {
  if (!activeTab?.id) return;
  exportButton.disabled = true;
  exportButton.textContent = "打包中…";
  setStatus("正在读取帖子和完整评论…", "working");
  try {
    const response = await chrome.runtime.sendMessage({
      type: "XIAOE_EXPORT_REQUEST",
      tabId: activeTab.id,
      detailUrl: activeTab.url,
    });
    if (!response?.ok) throw new Error(response?.error || "导出失败。");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
    exportButton.disabled = false;
    exportButton.textContent = "重新打包";
  }
});

async function initialize() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = activeTab?.url || "";
  if (!url.startsWith("https://quanzi.xiaoe-tech.com/")) {
    setStatus("请先打开鹅圈子页面。", "error");
    hintElement.textContent = "插件只会在 quanzi.xiaoe-tech.com 上运行。";
    return;
  }
  if (new URL(url).pathname.includes("/feed_detail")) {
    setStatus("已识别帖子详情页，可以开始打包。", "ready");
    exportButton.disabled = false;
    return;
  }
  setStatus("当前是帖子列表页。", "ready");
  hintElement.textContent = "请点击目标帖子右下方新出现的“打包下载”按钮。";
}

function setStatus(message, state) {
  statusElement.textContent = message;
  statusDot.className = "status-dot";
  if (state) statusDot.classList.add(`status-dot--${state}`);
}
