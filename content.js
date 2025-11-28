/**
 * content.js
 * 运行在网页上。接收文本，计算统计数据，并渲染 UI。
 */

// 防止重复注入监听器
if (!window.hasWordCountListener) {
  window.hasWordCountListener = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SHOW_STATS") {
      const stats = calculateStats(request.text);
      showPopup(stats);
    } else if (request.action === "ANALYZE_PAGE") {
      // 收到分析页面的请求
      const result = analyzePageWords();
      sendResponse(result);
    }
  });

  // 页面加载完成后，检查是否开启了自动采集
  checkAndAutoCollect();
}

function checkAndAutoCollect() {
  chrome.storage.local.get({ autoCollect: false }, (result) => {
    if (result.autoCollect) {
      // 给页面一点时间加载动态内容
      setTimeout(() => {
        const analysis = analyzePageWords();
        if (analysis.list.length > 0) {
          saveToVocabularySilent(analysis.list);
        }
      }, 2000);
    }
  });
}

/**
 * 静默保存单词到 storage (用于自动采集)
 */
function saveToVocabularySilent(wordList) {
  chrome.storage.local.get({ vocabulary: {} }, (result) => {
    const vocab = result.vocabulary;
    const MAX_WORDS = 1000;
    
    wordList.forEach(item => {
      const existing = vocab[item.word];

      // 1. 如果已存在
      if (existing) {
        // 如果是已学会(mastered) 或 已忽略(ignored)，则不更新计数，不变成生词，直接跳过
        if (existing.status === 'mastered' || existing.status === 'ignored') {
            return;
        }
        // 如果是学习中，增加计数
        existing.count += item.count;
        existing.updatedAt = Date.now();
      } else {
        // 2. 如果是新词
        // 检查容量上限
        if (Object.keys(vocab).length >= MAX_WORDS) {
            return; // 满了就不加了
        }
        
        vocab[item.word] = {
          word: item.word,
          count: item.count,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'learning'
        };
      }
    });

    chrome.storage.local.set({ vocabulary: vocab });
  });
}

/**
 * 分析页面所有的英语单词
 */
function analyzePageWords() {
  const text = document.body.innerText;
  
  // 匹配英语单词 (必须以字母开头，允许中间有连字符或撇号)
  const words = text.match(/\b[a-zA-Z]+(['-][a-zA-Z]+)*\b/g) || [];

  // 常用停用词列表 (Stop Words)，过滤掉对学习生词无意义的高频词
  const stopWords = new Set([
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", 
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at", 
    "this", "but", "his", "by", "from", "they", "we", "say", "her", 
    "she", "or", "an", "will", "my", "one", "all", "would", "there", 
    "their", "what", "so", "up", "out", "if", "about", "who", "get", 
    "which", "go", "me", "when", "make", "can", "like", "time", "no", 
    "just", "him", "know", "take", "people", "into", "year", "your", 
    "good", "some", "could", "them", "see", "other", "than", "then", 
    "now", "look", "only", "come", "its", "over", "think", "also", 
    "back", "after", "use", "two", "how", "our", "work", "first", 
    "well", "way", "even", "new", "want", "because", "any", "these", 
    "give", "day", "most", "us", "is", "are", "was", "were", "has", "had"
  ]);

  const frequency = {};
  
  words.forEach(word => {
    const lower = word.toLowerCase();
    
    // 过滤掉长度小于2的词
    if (lower.length < 2) return;
    
    // 过滤停用词
    if (stopWords.has(lower)) return;

    frequency[lower] = (frequency[lower] || 0) + 1;
  });

  // 转换为数组并按频率降序排序
  const sortedList = Object.keys(frequency).map(word => ({
    word: word,
    count: frequency[word]
  })).sort((a, b) => b.count - a.count);

  return {
    totalWords: words.length, // 总英语单词数
    filteredWords: sortedList.length, // 过滤后的生词本数量
    list: sortedList
  };
}

/**
 * 计算字数和字符统计。
 * 使用 Intl.Segmenter 实现精准的多语言分词 (支持中文、英文等)。
 */
function calculateStats(text) {
  // 使用浏览器原生的分词器
  const segmenter = new Intl.Segmenter([], { granularity: 'word' });
  const segments = [...segmenter.segment(text)];
  
  // 计算词数 (排除纯空格或标点符号)
  const wordCount = segments.filter(s => s.isWordLike).length;
  
  return {
    words: wordCount,
    chars: text.length,
    charsNoSpace: text.replace(/\s/g, '').length,
    lines: text.split(/\r\n|\r|\n/).length
  };
}

/**
 * 使用 Shadow DOM 创建并注入弹出层 UI，以防止样式冲突。
 */
function showPopup(stats) {
  // 移除已存在的弹窗
  const existingHost = document.getElementById('wc-extension-host');
  if (existingHost) existingHost.remove();

  // 创建宿主元素
  const host = document.createElement('div');
  host.id = 'wc-extension-host';
  document.body.appendChild(host);

  // 挂载 Shadow DOM
  const shadow = host.attachShadow({ mode: 'open' });

  // 样式 (仿 Tailwind CSS 风格)
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      z-index: 2147483647;
      position: fixed;
      top: 20px;
      right: 20px;
      font-family: "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 12px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      padding: 16px;
      min-width: 220px;
      color: #1f2937;
      animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-bottom: 1px solid #f3f4f6;
      padding-bottom: 8px;
    }
    .title {
      font-weight: 600;
      font-size: 14px;
      color: #374151;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .close-btn {
      cursor: pointer;
      background: transparent;
      border: none;
      color: #9ca3af;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .close-btn:hover {
      background: #f3f4f6;
      color: #4b5563;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .stat-item {
      display: flex;
      flex-direction: column;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      line-height: 1.2;
    }
    .stat-label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 2px;
    }
  `;

  // HTML 内容
  const container = document.createElement('div');
  container.className = 'card';
  container.innerHTML = `
    <div class="header">
      <div class="title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        统计信息
      </div>
      <button class="close-btn" id="close-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="grid">
      <div class="stat-item">
        <span class="stat-value">${stats.words}</span>
        <span class="stat-label">词数</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.chars}</span>
        <span class="stat-label">字符数</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.charsNoSpace}</span>
        <span class="stat-label">去空字符</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.lines}</span>
        <span class="stat-label">行数</span>
      </div>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(container);

  // 关闭逻辑
  const closeBtn = shadow.getElementById('close-btn');
  const removePopup = () => host.remove();
  
  closeBtn.addEventListener('click', removePopup);

  // 5秒后自动关闭
  setTimeout(removePopup, 5000);
  
  // 点击弹窗外部关闭
  document.addEventListener('mousedown', (e) => {
    if (e.target !== host) removePopup();
  }, { once: true });
}