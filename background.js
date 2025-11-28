/**
 * background.js
 * 处理右键菜单的创建和点击事件。
 */

// 扩展安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "count-selection-stats",
    title: "统计字数与字符",
    contexts: ["selection"]
  });
});

// 监听菜单项点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "count-selection-stats" && tab.id) {
    // 将选中的文本发送给当前标签页的 content script
    // 从 background 发送可以确保我们获取到的是浏览器原生的选中文本
    chrome.tabs.sendMessage(tab.id, {
      action: "SHOW_STATS",
      text: info.selectionText
    }).catch((err) => {
      console.warn("无法发送消息到标签页。可能是受限制的 URL (如 chrome://) 或者 content script 尚未加载。", err);
    });
  }
});