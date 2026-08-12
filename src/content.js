const BUTTON_CLASS = "xiaoe-circle-export-button";
const STYLE_ID = "xiaoe-circle-export-style";
let scanScheduled = false;

installStyles();
scanPage();

const observer = new MutationObserver(scheduleScan);
observer.observe(document.documentElement, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "XIAOE_EXPORT_PROGRESS") return;
  showToast(message.message, message.state);
  const busy = message.state === "working";
  for (const button of document.querySelectorAll(`.${BUTTON_CLASS}`)) {
    button.disabled = busy;
    button.textContent = busy ? "打包中…" : "打包下载";
  }
});

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
  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.textContent = "打包下载";
  button.title = "下载正文、附件和完整评论";
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.disabled = true;
    button.textContent = "打包中…";
    showToast("正在读取帖子详情…", "working");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "XIAOE_EXPORT_REQUEST",
        detailUrl,
      });
      if (!response?.ok) throw new Error(response?.error || "导出失败。");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
      button.disabled = false;
      button.textContent = "重新打包";
    }
  });

  const actionBar = card.querySelector(".interactive-bar");
  if (actionBar) actionBar.append(button);
  else card.append(button);
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
    }, 6000);
  }
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${BUTTON_CLASS} {
      appearance: none;
      margin-left: auto;
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
