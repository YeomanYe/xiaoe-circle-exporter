(() => {
  // src/popup.js
  var statusElement = document.getElementById("status");
  var statusDot = document.getElementById("status-dot");
  var exportButton = document.getElementById("export");
  var hintElement = document.getElementById("hint");
  var activeTab;
  initialize();
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "XIAOE_EXPORT_PROGRESS") return;
    setStatus(message.message, message.state);
    exportButton.disabled = message.state === "working";
    if (message.state === "done") exportButton.textContent = "\u5DF2\u5F00\u59CB\u4E0B\u8F7D";
    if (message.state === "error") exportButton.textContent = "\u91CD\u65B0\u6253\u5305";
  });
  exportButton.addEventListener("click", async () => {
    if (!activeTab?.id) return;
    exportButton.disabled = true;
    exportButton.textContent = "\u6253\u5305\u4E2D\u2026";
    setStatus("\u6B63\u5728\u8BFB\u53D6\u5E16\u5B50\u548C\u5B8C\u6574\u8BC4\u8BBA\u2026", "working");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "XIAOE_EXPORT_REQUEST",
        tabId: activeTab.id,
        detailUrl: activeTab.url
      });
      if (!response?.ok) throw new Error(response?.error || "\u5BFC\u51FA\u5931\u8D25\u3002");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), "error");
      exportButton.disabled = false;
      exportButton.textContent = "\u91CD\u65B0\u6253\u5305";
    }
  });
  async function initialize() {
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = activeTab?.url || "";
    if (!url.startsWith("https://quanzi.xiaoe-tech.com/")) {
      setStatus("\u8BF7\u5148\u6253\u5F00\u9E45\u5708\u5B50\u9875\u9762\u3002", "error");
      hintElement.textContent = "\u63D2\u4EF6\u53EA\u4F1A\u5728 quanzi.xiaoe-tech.com \u4E0A\u8FD0\u884C\u3002";
      return;
    }
    if (new URL(url).pathname.includes("/feed_detail")) {
      setStatus("\u5DF2\u8BC6\u522B\u5E16\u5B50\u8BE6\u60C5\u9875\uFF0C\u53EF\u4EE5\u5F00\u59CB\u6253\u5305\u3002", "ready");
      exportButton.disabled = false;
      return;
    }
    setStatus("\u5F53\u524D\u662F\u5E16\u5B50\u5217\u8868\u9875\u3002", "ready");
    hintElement.textContent = "\u8BF7\u70B9\u51FB\u76EE\u6807\u5E16\u5B50\u53F3\u4E0B\u65B9\u65B0\u51FA\u73B0\u7684\u201C\u6253\u5305\u4E0B\u8F7D\u201D\u6309\u94AE\u3002";
  }
  function setStatus(message, state) {
    statusElement.textContent = message;
    statusDot.className = "status-dot";
    if (state) statusDot.classList.add(`status-dot--${state}`);
  }
})();
