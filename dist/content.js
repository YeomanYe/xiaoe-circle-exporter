(() => {
  // src/content.js
  var BUTTON_CLASS = "xiaoe-circle-export-button";
  var STYLE_ID = "xiaoe-circle-export-style";
  var scanScheduled = false;
  installStyles();
  scanPage();
  var observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "XIAOE_EXPORT_PROGRESS") return;
    showToast(message.message, message.state);
    const busy = message.state === "working";
    for (const button of document.querySelectorAll(`.${BUTTON_CLASS}`)) {
      button.disabled = busy;
      button.textContent = busy ? "\u6253\u5305\u4E2D\u2026" : "\u6253\u5305\u4E0B\u8F7D";
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
    button.textContent = "\u6253\u5305\u4E0B\u8F7D";
    button.title = "\u4E0B\u8F7D\u6B63\u6587\u3001\u9644\u4EF6\u548C\u5B8C\u6574\u8BC4\u8BBA";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      button.textContent = "\u6253\u5305\u4E2D\u2026";
      showToast("\u6B63\u5728\u8BFB\u53D6\u5E16\u5B50\u8BE6\u60C5\u2026", "working");
      try {
        const response = await chrome.runtime.sendMessage({
          type: "XIAOE_EXPORT_REQUEST",
          detailUrl
        });
        if (!response?.ok) throw new Error(response?.error || "\u5BFC\u51FA\u5931\u8D25\u3002");
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error), "error");
        button.disabled = false;
        button.textContent = "\u91CD\u65B0\u6253\u5305";
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
      }, 6e3);
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
})();
