/**
 * popup.js
 */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('list-container');
  const totalEl = document.getElementById('total-val');
  const uniqueEl = document.getElementById('unique-val');
  const copyBtn = document.getElementById('copy-btn');
  const saveBtn = document.getElementById('save-btn');
  const goStudyLink = document.getElementById('go-study-link');
  
  let currentWordList = [];

  // 导航到学习页
  goStudyLink.addEventListener('click', () => {
    chrome.tabs.create({ url: 'study.html' });
  });

  // 获取当前激活的标签页
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];

    // 确保我们在一个可以注入脚本的网页上
    if (!activeTab || !activeTab.id || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://')) {
      showError("无法在当前页面运行。请在普通网页上使用。");
      return;
    }

    // 向 content script 发送请求
    chrome.tabs.sendMessage(activeTab.id, { action: "ANALYZE_PAGE" }, (response) => {
      // 检查运行时错误 (例如 content script 未加载)
      if (chrome.runtime.lastError) {
        showError("请刷新页面后重试，或确保页面加载完成。");
        return;
      }

      if (response) {
        renderList(response);
      } else {
        showError("未获取到数据。");
      }
    });
  });

  function showError(msg) {
    container.innerHTML = `<div class="error-msg">${msg}</div>`;
    totalEl.textContent = "0";
    uniqueEl.textContent = "0";
    copyBtn.disabled = true;
    saveBtn.disabled = true;
    copyBtn.style.opacity = "0.5";
    saveBtn.style.opacity = "0.5";
  }

  function renderList(data) {
    totalEl.textContent = data.totalWords;
    uniqueEl.textContent = data.filteredWords;
    currentWordList = data.list;

    if (data.list.length === 0) {
      container.innerHTML = '<div class="empty-state">页面上未发现有价值的英语生词。</div>';
      saveBtn.disabled = true;
      saveBtn.style.opacity = "0.5";
      return;
    }

    let html = '<ul class="word-list">';
    data.list.forEach(item => {
      html += `
        <li class="word-item">
          <span class="word-text">${item.word}</span>
          <span class="word-count">${item.count}</span>
        </li>
      `;
    });
    html += '</ul>';
    container.innerHTML = html;
  }

  // 复制功能
  copyBtn.addEventListener('click', () => {
    if (currentWordList.length === 0) return;

    const textToCopy = currentWordList
      .map(item => `${item.word} (${item.count})`)
      .join('\n');
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "已复制";
      
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    });
  });

  // 保存功能
  saveBtn.addEventListener('click', () => {
    if (currentWordList.length === 0) return;

    // 从 storage 获取现有的生词本
    chrome.storage.local.get({ vocabulary: {} }, (result) => {
      const vocab = result.vocabulary;
      let newCount = 0;

      currentWordList.forEach(item => {
        if (vocab[item.word]) {
          // 如果词已存在，增加出现次数，更新时间
          vocab[item.word].count += item.count;
          vocab[item.word].updatedAt = Date.now();
        } else {
          // 新增词汇
          vocab[item.word] = {
            word: item.word,
            count: item.count,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          newCount++;
        }
      });

      // 保存回 storage
      chrome.storage.local.set({ vocabulary: vocab }, () => {
        const originalText = saveBtn.textContent;
        saveBtn.textContent = `已保存 ${newCount} 个新词`;
        saveBtn.style.background = "#059669"; // Green
        
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.style.background = "";
        }, 2000);
      });
    });
  });
});