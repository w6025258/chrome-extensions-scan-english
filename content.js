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
    }
  });
}

/**
 * 计算字数和字符统计。
 * 使用 Intl.Segmenter 实现精准的多语言分词 (支持中文、英文等)。
 */
function calculateStats(text) {
  // 使用浏览器原生的分词器，'zh' 环境下对中文分词更友好，这里留空让其自动探测或使用默认
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

  // 样式 (仿 Tailwind CSS 风格，无需外部依赖)
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
    .footer {
      margin-top: 12px;
      font-size: 11px;
      color: #9ca3af;
      text-align: right;
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
  
  // 点击弹窗外部关闭 (简化版)
  document.addEventListener('mousedown', (e) => {
    if (e.target !== host) removePopup();
  }, { once: true });
}