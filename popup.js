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
  const autoCollectToggle = document.getElementById('auto-collect-toggle');
  
  let currentWordList = [];

  // 1. 初始化自动采集开关状态
  chrome.storage.local.get({ autoCollect: false }, (result) => {
    autoCollectToggle.checked = result.autoCollect;
  });

  autoCollectToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ autoCollect: e.target.checked });
  });

  goStudyLink.addEventListener('click', () => {
    chrome.tabs.create({ url: 'study.html' });
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.id || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://')) {
      showError("无法在当前页面运行。请在普通网页上使用。");
      return;
    }

    // 先获取已有的词汇库，用于过滤 "已学会" 和 "已忽略" 的词
    chrome.storage.local.get({ vocabulary: {} }, (storageResult) => {
      const existingVocab = storageResult.vocabulary;

      chrome.tabs.sendMessage(activeTab.id, { action: "ANALYZE_PAGE" }, (response) => {
        if (chrome.runtime.lastError) {
          showError("请刷新页面后重试，或确保页面加载完成。");
          return;
        }

        if (response) {
          // 过滤逻辑：如果在词库中且状态是 mastered 或 ignored，则不显示为待保存的新词
          const filteredList = response.list.filter(item => {
            const existing = existingVocab[item.word];
            if (existing) {
              if (existing.status === 'mastered' || existing.status === 'ignored') {
                return false;
              }
            }
            return true;
          });

          const displayData = {
            ...response,
            list: filteredList,
            filteredWords: filteredList.length
          };
          
          renderList(displayData);
        } else {
          showError("未获取到数据。");
        }
      });
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
      container.innerHTML = '<div class="empty-state">页面上未发现新单词。<br>(已掌握或忽略的单词已隐藏)</div>';
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

  copyBtn.addEventListener('click', () => {
    if (currentWordList.length === 0) return;
    const textToCopy = currentWordList
      .map(item => `${item.word} (${item.count})`)
      .join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "已复制";
      setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
    });
  });

  saveBtn.addEventListener('click', () => {
    if (currentWordList.length === 0) return;
    saveWordsToStorage(currentWordList, (newCount, full) => {
      const originalText = saveBtn.textContent;
      if (full) {
        saveBtn.textContent = "生词本已满(1000)";
        saveBtn.style.background = "#ef4444";
      } else {
        saveBtn.textContent = `已存 ${newCount} 个新词`;
        saveBtn.style.background = "#059669";
      }
      
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = "";
      }, 2000);
    });
  });

  function saveWordsToStorage(wordList, callback) {
    chrome.storage.local.get({ vocabulary: {} }, (result) => {
      const vocab = result.vocabulary;
      const MAX_WORDS = 1000;
      let newCount = 0;
      let isFull = false;

      wordList.forEach(item => {
        // 如果词库满了，且当前词不在库中，则跳过
        if (Object.keys(vocab).length >= MAX_WORDS && !vocab[item.word]) {
            isFull = true;
            return;
        }

        if (vocab[item.word]) {
          // 已存在，只增加计数（如果状态是 learning）
          // 这里的列表已经被 UI 过滤过了，所以进来的应该是 learning 或新词
          // 双重保险：
          if (vocab[item.word].status !== 'mastered' && vocab[item.word].status !== 'ignored') {
             vocab[item.word].count += item.count;
             vocab[item.word].updatedAt = Date.now();
          }
        } else {
          // 新增
          vocab[item.word] = {
            word: item.word,
            count: item.count,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: 'learning' // 默认为学习中
          };
          newCount++;
        }
      });

      chrome.storage.local.set({ vocabulary: vocab }, () => {
        if (callback) callback(newCount, isFull);
      });
    });
  }
});