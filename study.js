/**
 * study.js
 */

document.addEventListener('DOMContentLoaded', () => {
  const MAX_WORDS = 1000;
  
  const wordGrid = document.getElementById('word-grid');
  const clearBtn = document.getElementById('clear-all');
  const toggleBatchBtn = document.getElementById('toggle-batch');
  const batchArea = document.getElementById('batch-area');
  const batchInput = document.getElementById('batch-input');
  const cancelBatchBtn = document.getElementById('cancel-batch');
  const confirmBatchBtn = document.getElementById('confirm-batch');
  const limitWarning = document.getElementById('limit-warning');
  const vocabCountEl = document.getElementById('vocab-count');
  
  const tabs = document.querySelectorAll('.tab');
  const sortSelect = document.getElementById('sort-select');
  const sortWrapper = document.getElementById('sort-wrapper');
  
  // Flashcard elements
  const flashcardView = document.getElementById('flashcard-view');
  const listView = document.getElementById('list-view');
  const fcContent = document.getElementById('fc-content');
  const fcTranslation = document.getElementById('fc-translation');
  const fcDont = document.getElementById('fc-dont');
  const fcKnow = document.getElementById('fc-know');
  const flashcard = document.getElementById('flashcard');

  let fullVocabulary = {}; // Map: word -> object
  let currentTabStatus = 'learning'; // 'learning', 'mastered', 'ignored'
  let currentCardIndex = 0;
  let learningList = []; // Array for flashcards

  // 初始化
  loadVocabulary();

  // 批量添加 UI 切换
  toggleBatchBtn.addEventListener('click', () => {
    batchArea.style.display = batchArea.style.display === 'block' ? 'none' : 'block';
  });
  cancelBatchBtn.addEventListener('click', () => {
    batchArea.style.display = 'none';
    batchInput.value = '';
  });

  // 批量添加逻辑
  confirmBatchBtn.addEventListener('click', () => {
    const text = batchInput.value;
    if (!text.trim()) return;

    const words = text.match(/\b[a-zA-Z]+(['-][a-zA-Z]+)*\b/g) || [];
    if (words.length === 0) return;

    const currentCount = Object.keys(fullVocabulary).length;
    if (currentCount >= MAX_WORDS) {
      alert('词库已达到 1000 词上限，无法添加。');
      return;
    }

    let addedCount = 0;
    words.forEach(rawWord => {
      // 检查上限
      if (Object.keys(fullVocabulary).length >= MAX_WORDS && !fullVocabulary[rawWord.toLowerCase()]) {
        return; 
      }

      const word = rawWord.toLowerCase();
      if (word.length < 2) return;

      if (!fullVocabulary[word]) {
        fullVocabulary[word] = {
          word: word,
          count: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'learning'
        };
        addedCount++;
      } else {
        // 如果已存在，即使是 ignored/mastered，手动批量添加时是否要重置为 learning?
        // 这里策略：手动导入表示强制学习，重置为 learning
        if (fullVocabulary[word].status !== 'learning') {
            fullVocabulary[word].status = 'learning';
            addedCount++;
        }
        fullVocabulary[word].count += 1;
        fullVocabulary[word].updatedAt = Date.now();
      }
    });

    saveVocabulary(() => {
      alert(`成功添加/更新了 ${addedCount} 个单词。`);
      batchArea.style.display = 'none';
      batchInput.value = '';
      loadVocabulary();
    });
  });

  // 清空数据
  clearBtn.addEventListener('click', () => {
    if (confirm('确定要清空所有数据（包括已掌握和忽略的词）吗？此操作无法撤销。')) {
      chrome.storage.local.remove('vocabulary', () => {
        loadVocabulary();
      });
    }
  });

  sortSelect.addEventListener('change', renderList);

  // Tab 切换
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const target = tab.dataset.target;
      const status = tab.dataset.status;

      if (target === 'list-view') {
        currentTabStatus = status;
        listView.style.display = 'block';
        flashcardView.style.display = 'none';
        sortWrapper.style.display = 'flex';
        renderList();
      } else {
        listView.style.display = 'none';
        flashcardView.style.display = 'flex';
        sortWrapper.style.display = 'none';
        startFlashcards();
      }
    });
  });

  function loadVocabulary() {
    chrome.storage.local.get({ vocabulary: {} }, (result) => {
      fullVocabulary = result.vocabulary || {};
      updateCountUI();
      renderList();
    });
  }

  function saveVocabulary(callback) {
    chrome.storage.local.set({ vocabulary: fullVocabulary }, () => {
      updateCountUI();
      if (callback) callback();
    });
  }

  function updateCountUI() {
    const count = Object.keys(fullVocabulary).length;
    vocabCountEl.textContent = `${count}/${MAX_WORDS}`;
    vocabCountEl.style.color = count >= MAX_WORDS ? '#ef4444' : '#6b7280';
    
    if (count >= MAX_WORDS) {
        limitWarning.style.display = 'block';
    } else {
        limitWarning.style.display = 'none';
    }
  }

  function renderList() {
    wordGrid.innerHTML = '';
    
    // 筛选当前 Tab 状态的词
    let list = Object.values(fullVocabulary).filter(item => {
        // 兼容旧数据，无 status 默认为 learning
        const status = item.status || 'learning';
        return status === currentTabStatus;
    });

    if (list.length === 0) {
      const statusMap = { 'learning': '生词本', 'mastered': '已学会', 'ignored': '已忽略' };
      wordGrid.innerHTML = `<div class="empty-vocab">“${statusMap[currentTabStatus]}”列表为空。</div>`;
      return;
    }

    // 排序
    const sortType = sortSelect.value;
    list.sort((a, b) => {
      if (sortType === 'frequency') return b.count - a.count;
      return b.updatedAt - a.updatedAt;
    });

    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'word-card';
      
      const date = new Date(item.updatedAt).toLocaleDateString();
      
      // 根据不同 Tab 显示不同按钮
      let actionsHtml = '';
      if (currentTabStatus === 'learning') {
          // 生词本：显示“掌握(绿)”和“忽略(黑)”
          actionsHtml = `
            <div class="status-actions">
                <div class="icon-btn btn-master" title="标记为已学会" data-word="${item.word}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div class="icon-btn btn-ignore" title="忽略/垃圾数据" data-word="${item.word}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                </div>
            </div>
          `;
      } else if (currentTabStatus === 'mastered') {
          // 已学会：显示“重学”
          actionsHtml = `
            <div class="status-actions">
                <div class="icon-btn btn-ignore" title="重新放入生词本" data-word="${item.word}" style="transform: rotate(180deg)">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                </div>
            </div>
          `;
      } else {
          // 已忽略：显示“恢复”
          actionsHtml = `
            <div class="status-actions">
                <div class="icon-btn btn-master" title="恢复到生词本" data-word="${item.word}">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                </div>
            </div>
          `;
      }

      card.innerHTML = `
        <div class="card-header">
            <span class="card-word">${item.word}</span>
            ${actionsHtml}
        </div>
        <div class="card-meta">
          <div>频次: ${item.count}</div>
          <div>更新: ${date}</div>
        </div>
        <div class="card-footer">
          <a class="action-link" href="https://translate.google.com/?sl=en&tl=zh-CN&text=${item.word}&op=translate" target="_blank">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            翻译
          </a>
        </div>
      `;

      // 绑定按钮事件
      const masterBtn = card.querySelector('.btn-master');
      const ignoreBtn = card.querySelector('.btn-ignore');

      if (masterBtn) {
          masterBtn.addEventListener('click', () => {
              if (currentTabStatus === 'ignored') changeStatus(item.word, 'learning'); // 恢复
              else changeStatus(item.word, 'mastered'); // 标记掌握
          });
      }
      if (ignoreBtn) {
          ignoreBtn.addEventListener('click', () => {
              if (currentTabStatus === 'mastered') changeStatus(item.word, 'learning'); // 重学
              else changeStatus(item.word, 'ignored'); // 标记忽略
          });
      }

      wordGrid.appendChild(card);
    });
  }

  function changeStatus(word, newStatus) {
    if (fullVocabulary[word]) {
        fullVocabulary[word].status = newStatus;
        fullVocabulary[word].updatedAt = Date.now();
        saveVocabulary(() => renderList());
    }
  }

  // --- Flashcard Logic ---

  function startFlashcards() {
    // 只能学 'learning' 状态的词
    learningList = Object.values(fullVocabulary).filter(item => {
        const status = item.status || 'learning';
        return status === 'learning';
    }).sort((a, b) => b.count - a.count); // 默认按高频

    if (learningList.length === 0) {
      fcContent.textContent = "生词本空空如也";
      fcTranslation.style.display = 'none';
      fcKnow.style.display = 'none';
      fcDont.style.display = 'none';
      return;
    } else {
      fcKnow.style.display = 'inline-block';
      fcDont.style.display = 'inline-block';
    }
    
    currentCardIndex = 0;
    showCard(currentCardIndex);
  }

  function showCard(index) {
    if (learningList.length === 0) {
         fcContent.textContent = "已全部完成";
         fcTranslation.style.display = 'none';
         fcKnow.style.display = 'none';
         fcDont.style.display = 'none';
         return;
    }

    if (index >= learningList.length) {
      currentCardIndex = 0; 
    }
    const wordObj = learningList[currentCardIndex];
    fcContent.textContent = wordObj ? wordObj.word : "完成";
    
    // 重置翻译气泡
    fcTranslation.style.display = 'none';
    fcTranslation.textContent = '';
  }

  // 点击“不会”：下一个
  fcDont.addEventListener('click', () => {
    if (learningList.length === 0) return;
    currentCardIndex++;
    if (currentCardIndex >= learningList.length) currentCardIndex = 0;
    showCard(currentCardIndex);
  });

  // 点击“会”：加入已学会，移出列表，下一个
  fcKnow.addEventListener('click', () => {
     if (learningList.length === 0) return;
     const word = learningList[currentCardIndex].word;
     
     // 更新状态
     if (fullVocabulary[word]) {
         fullVocabulary[word].status = 'mastered';
         fullVocabulary[word].updatedAt = Date.now();
         
         // 从当前复习队列移除
         learningList.splice(currentCardIndex, 1);
         
         // 保存
         saveVocabulary();
         
         // 如果移除后 index 越界，修正
         if (currentCardIndex >= learningList.length) {
             currentCardIndex = 0;
         }
         
         showCard(currentCardIndex);
     }
  });

  // 点击卡片：显示翻译气泡
  flashcard.addEventListener('click', async (e) => {
    // 避免点到按钮时触发
    if (e.target.tagName === 'BUTTON') return;
    if (learningList.length === 0) return;

    const word = learningList[currentCardIndex].word;
    
    // 如果已经显示了，就不重复请求
    if (fcTranslation.style.display === 'block') return;

    fcTranslation.textContent = '加载翻译中...';
    fcTranslation.style.display = 'block';

    try {
        const trans = await fetchTranslation(word);
        fcTranslation.textContent = trans;
    } catch (err) {
        console.error(err);
        fcTranslation.textContent = '翻译失败，请检查网络';
    }
  });

  async function fetchTranslation(word) {
      // 使用 Google Translate API (Client: gtx)
      // 需要在 manifest.json 中配置 host_permissions: ["https://translate.googleapis.com/*"]
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`;
      const res = await fetch(url);
      const data = await res.json();
      // 返回结构通常是 [[["翻译", "原词", ...], ...], ...]
      if (data && data[0] && data[0][0] && data[0][0][0]) {
          return data[0][0][0];
      }
      return "未找到翻译";
  }

});