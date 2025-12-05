/**
 * study.js
 */

document.addEventListener('DOMContentLoaded', () => {
  const MAX_WORDS = 1000;
  
  const wordGrid = document.getElementById('word-grid');
  const clearLearningBtn = document.getElementById('clear-learning');
  const clearMasteredBtn = document.getElementById('clear-mastered');
  const clearIgnoredBtn = document.getElementById('clear-ignored');

  const resetCountBtn = document.getElementById('reset-count-btn');
  const toggleBatchBtn = document.getElementById('toggle-batch');
  const batchArea = document.getElementById('batch-area');
  const batchInput = document.getElementById('batch-input');
  const cancelBatchBtn = document.getElementById('cancel-batch');
  const confirmBatchBtn = document.getElementById('confirm-batch');
  const limitWarning = document.getElementById('limit-warning');
  const vocabCountEl = document.getElementById('vocab-count');
  
  const tabs = document.querySelectorAll('.tab');
  const tabLearning = document.getElementById('tab-learning');
  const tabMastered = document.getElementById('tab-mastered');
  const tabIgnored = document.getElementById('tab-ignored');
  const tabFlashcard = document.getElementById('tab-flashcard');

  // Chart Elements
  const barLearning = document.getElementById('bar-learning');
  const barMastered = document.getElementById('bar-mastered');
  const barIgnored = document.getElementById('bar-ignored');

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
  const fcAudioBtn = document.getElementById('fc-audio-btn');
  const fcExternalLink = document.getElementById('fc-external-link');

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
      // 过滤异常单词
      if (!isLikelyRealWord(rawWord)) return;

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

  // 通用清空函数
  function clearByStatus(status, label) {
    const itemsToDelete = Object.values(fullVocabulary).filter(item => {
        const s = item.status || 'learning';
        return s === status;
    });

    if (itemsToDelete.length === 0) {
        alert(`“${label}”列表已经是空的。`);
        return;
    }

    if (confirm(`确定要清空“${label}”列表吗？(共 ${itemsToDelete.length} 个单词)\n此操作无法撤销。`)) {
        // 重建对象，过滤掉目标状态的词
        const newVocab = {};
        Object.values(fullVocabulary).forEach(item => {
            const s = item.status || 'learning';
            if (s !== status) {
                newVocab[item.word] = item;
            }
        });
        
        fullVocabulary = newVocab;
        saveVocabulary(() => {
            alert(`已清空“${label}”。`);
            renderList();
        });
    }
  }

  clearLearningBtn.addEventListener('click', () => clearByStatus('learning', '生词本'));
  clearMasteredBtn.addEventListener('click', () => clearByStatus('mastered', '已学会'));
  clearIgnoredBtn.addEventListener('click', () => clearByStatus('ignored', '已忽略'));

  // 重置计数
  resetCountBtn.addEventListener('click', () => {
      if (confirm('确定要将所有单词（包括生词、学会、忽略）的出现频率计数重置为 0 吗？')) {
          Object.values(fullVocabulary).forEach(word => {
              word.count = 0;
          });
          saveVocabulary(() => {
              renderList();
              alert('所有计数已重置。');
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
    const totalCount = Object.keys(fullVocabulary).length;
    
    // 分类统计
    let learningCount = 0;
    let masteredCount = 0;
    let ignoredCount = 0;
    
    Object.values(fullVocabulary).forEach(item => {
        const s = item.status || 'learning';
        if (s === 'learning') learningCount++;
        else if (s === 'mastered') masteredCount++;
        else if (s === 'ignored') ignoredCount++;
    });

    // 更新 Tab 显示
    if(tabLearning) tabLearning.textContent = `生词本 (${learningCount})`;
    if(tabMastered) tabMastered.textContent = `已学会 (${masteredCount})`;
    if(tabIgnored) tabIgnored.textContent = `已忽略 (${ignoredCount})`;
    if(tabFlashcard) tabFlashcard.textContent = `单词卡片 (${learningCount})`;

    // 更新头部总容量显示
    vocabCountEl.textContent = `${totalCount}/${MAX_WORDS}`;
    vocabCountEl.style.color = totalCount >= MAX_WORDS ? '#ef4444' : '#6b7280';
    
    if (totalCount >= MAX_WORDS) {
        limitWarning.style.display = 'inline';
    } else {
        limitWarning.style.display = 'none';
    }

    // 更新图表 (Chart)
    if (totalCount === 0) {
      barLearning.style.width = '0%';
      barMastered.style.width = '0%';
      barIgnored.style.width = '0%';
    } else {
      const learningPct = (learningCount / totalCount * 100).toFixed(1);
      const masteredPct = (masteredCount / totalCount * 100).toFixed(1);
      const ignoredPct = (ignoredCount / totalCount * 100).toFixed(1);

      barLearning.style.width = `${learningPct}%`;
      barMastered.style.width = `${masteredPct}%`;
      barIgnored.style.width = `${ignoredPct}%`;

      barLearning.title = `生词本: ${learningCount} (${learningPct}%)`;
      barMastered.title = `已学会: ${masteredCount} (${masteredPct}%)`;
      barIgnored.title = `已忽略: ${ignoredCount} (${ignoredPct}%)`;
    }
  }

  function renderList() {
    wordGrid.innerHTML = '';
    
    // 筛选当前 Tab 状态的词
    let list = Object.values(fullVocabulary).filter(item => {
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
      
      // 状态切换按钮
      let statusActionsHtml = '';
      if (currentTabStatus === 'learning') {
          statusActionsHtml = `
            <div class="icon-btn btn-master" title="标记为已学会" data-action="master">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="icon-btn btn-ignore" title="忽略/垃圾数据" data-action="ignore">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
            </div>
          `;
      } else if (currentTabStatus === 'mastered') {
          statusActionsHtml = `
            <div class="icon-btn btn-ignore" title="重新放入生词本" data-action="restore" style="transform: rotate(180deg)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            </div>
          `;
      } else {
          statusActionsHtml = `
            <div class="icon-btn btn-master" title="恢复到生词本" data-action="restore">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            </div>
          `;
      }

      card.innerHTML = `
        <div class="card-header">
            <span class="card-word">${item.word}</span>
            <div style="display:flex; gap:6px;">${statusActionsHtml}</div>
        </div>
        <div class="card-meta">
          <span>${item.count} 次</span>
          <span>• ${date}</span>
        </div>
        
        <div class="trans-bubble" id="bubble-${item.word}"></div>

        <div class="card-actions">
          <div class="icon-btn" title="朗读" data-action="speak">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </div>
          <div class="icon-btn" title="显示翻译" data-action="translate">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          </div>
          <a class="icon-btn" href="https://translate.google.com/?sl=en&tl=zh-CN&text=${item.word}&op=translate" target="_blank" title="打开 Google 翻译">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </div>
      `;

      // 绑定事件
      card.querySelectorAll('.icon-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
           const action = btn.dataset.action;
           if (!action) return; // 外部链接不需要处理

           if (action === 'speak') {
               playAudio(item.word);
           } else if (action === 'translate') {
               toggleBubbleTranslation(item.word, card.querySelector('.trans-bubble'), btn);
           } else if (action === 'master') {
               changeStatus(item.word, 'mastered');
           } else if (action === 'ignore') {
               changeStatus(item.word, 'ignored');
           } else if (action === 'restore') {
               changeStatus(item.word, 'learning');
           }
        });
      });

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
  
  function playAudio(word) {
      // 停止当前正在播放的
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US'; 
      utterance.rate = 1.0; 
      window.speechSynthesis.speak(utterance);
  }

  async function toggleBubbleTranslation(word, bubbleEl, btnEl) {
      if (bubbleEl.style.display === 'block') {
          bubbleEl.style.display = 'none';
          btnEl.classList.remove('active');
          return;
      }

      btnEl.classList.add('active');
      bubbleEl.style.display = 'block';
      if (!bubbleEl.dataset.loaded) {
          bubbleEl.textContent = '加载中...';
          try {
              const trans = await fetchTranslation(word);
              bubbleEl.textContent = trans;
              bubbleEl.dataset.loaded = "true";
          } catch(err) {
              bubbleEl.textContent = '翻译失败';
          }
      }
  }

  // --- Flashcard Logic ---

  function startFlashcards() {
    learningList = Object.values(fullVocabulary).filter(item => {
        const status = item.status || 'learning';
        return status === 'learning';
    }).sort((a, b) => b.count - a.count);

    if (learningList.length === 0) {
      fcContent.textContent = "生词本空空如也";
      fcTranslation.style.display = 'none';
      fcKnow.style.display = 'none';
      fcDont.style.display = 'none';
      fcAudioBtn.style.display = 'none';
      fcExternalLink.style.display = 'none';
      return;
    } else {
      fcKnow.style.display = 'inline-block';
      fcDont.style.display = 'inline-block';
      fcAudioBtn.style.display = 'flex';
      fcExternalLink.style.display = 'inline-flex';
    }
    
    currentCardIndex = 0;
    showCard(currentCardIndex);
  }

  function showCard(index) {
    if (learningList.length === 0) return;

    if (index >= learningList.length) {
      currentCardIndex = 0; 
    }
    const wordObj = learningList[currentCardIndex];
    fcContent.textContent = wordObj.word;
    
    // 更新外部链接
    fcExternalLink.href = `https://translate.google.com/?sl=en&tl=zh-CN&text=${wordObj.word}&op=translate`;

    // 重置翻译气泡
    fcTranslation.style.display = 'none';
    fcTranslation.textContent = '';
  }

  fcDont.addEventListener('click', () => {
    if (learningList.length === 0) return;
    currentCardIndex++;
    if (currentCardIndex >= learningList.length) currentCardIndex = 0;
    showCard(currentCardIndex);
  });

  fcKnow.addEventListener('click', () => {
     if (learningList.length === 0) return;
     const word = learningList[currentCardIndex].word;
     
     if (fullVocabulary[word]) {
         fullVocabulary[word].status = 'mastered';
         fullVocabulary[word].updatedAt = Date.now();
         
         learningList.splice(currentCardIndex, 1);
         saveVocabulary();
         
         if (learningList.length === 0) {
             startFlashcards(); // refresh UI to empty state
             return;
         }

         if (currentCardIndex >= learningList.length) {
             currentCardIndex = 0;
         }
         showCard(currentCardIndex);
     }
  });
  
  // 卡片模式：朗读按钮
  fcAudioBtn.addEventListener('click', (e) => {
     e.stopPropagation(); // 阻止触发翻转/显示翻译
     if (learningList.length > 0) {
         playAudio(learningList[currentCardIndex].word);
     }
  });

  // 卡片模式：点击卡片显示翻译
  flashcard.addEventListener('click', async (e) => {
    // 避免点到内部按钮或链接时触发
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.icon-btn')) return;
    
    if (learningList.length === 0) return;

    const word = learningList[currentCardIndex].word;
    
    if (fcTranslation.style.display === 'block') return;

    fcTranslation.textContent = '加载翻译中...';
    fcTranslation.style.display = 'block';

    try {
        const trans = await fetchTranslation(word);
        fcTranslation.textContent = trans;
    } catch (err) {
        fcTranslation.textContent = '翻译失败';
    }
  });

  async function fetchTranslation(word) {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data[0] && data[0][0] && data[0][0][0]) {
          return data[0][0][0];
      }
      return "未找到翻译";
  }

  /**
   * 判断是否为“像样”的英语单词
   * 用于过滤代码变量、乱码、非单词缩写等
   */
  function isLikelyRealWord(word) {
    // 1. 长度限制
    if (word.length > 30) return false;

    // 2. 连续重复字符不能超过2个
    if (/(.)\1\1/.test(word)) return false;

    // 3. 必须包含至少一个元音
    if (!/[aeiouyAEIOUY]/.test(word)) return false;

    // 4. 驼峰命名过滤 (CamelCase)
    if (/[a-z][A-Z]/.test(word)) return false;

    return true;
  }
});