/**
 * study.js
 * 处理生词本页面的逻辑
 */

document.addEventListener('DOMContentLoaded', () => {
  const wordGrid = document.getElementById('word-grid');
  const clearBtn = document.getElementById('clear-all');
  const refreshBtn = document.getElementById('refresh-list');
  const tabs = document.querySelectorAll('.tab');
  
  // Flashcard elements
  const flashcardView = document.getElementById('flashcard-view');
  const listView = document.getElementById('list-view');
  const fcContent = document.getElementById('fc-content');
  const fcNext = document.getElementById('fc-next');
  const flashcard = document.getElementById('flashcard');

  let vocabulary = [];
  let currentCardIndex = 0;

  // 初始化
  loadVocabulary();

  // 绑定事件
  refreshBtn.addEventListener('click', loadVocabulary);
  
  clearBtn.addEventListener('click', () => {
    if (confirm('确定要清空所有生词记录吗？此操作无法撤销。')) {
      chrome.storage.local.remove('vocabulary', () => {
        loadVocabulary();
      });
    }
  });

  // Tab 切换
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const target = tab.dataset.target;
      if (target === 'list-view') {
        listView.style.display = 'block';
        flashcardView.style.display = 'none';
      } else {
        listView.style.display = 'none';
        flashcardView.style.display = 'flex';
        startFlashcards();
      }
    });
  });

  // 加载数据
  function loadVocabulary() {
    chrome.storage.local.get({ vocabulary: {} }, (result) => {
      const vocabObj = result.vocabulary;
      // 转换为数组并按更新时间降序排列
      vocabulary = Object.values(vocabObj).sort((a, b) => b.updatedAt - a.updatedAt);
      
      renderList();
    });
  }

  // 渲染列表
  function renderList() {
    wordGrid.innerHTML = '';

    if (vocabulary.length === 0) {
      wordGrid.innerHTML = '<div class="empty-vocab" style="grid-column: 1/-1">暂无单词记录。请在浏览网页时点击插件图标进行添加。</div>';
      return;
    }

    vocabulary.forEach(item => {
      const card = document.createElement('div');
      card.className = 'word-card';
      
      const date = new Date(item.updatedAt).toLocaleDateString();
      
      card.innerHTML = `
        <span class="card-word">${item.word}</span>
        <div class="card-meta">
          <span>出现 ${item.count} 次</span>
          <span>${date}</span>
        </div>
        <div class="card-actions">
          <a class="action-link" href="https://fanyi.baidu.com/#en/zh/${item.word}" target="_blank">百度翻译</a>
          <a class="action-link" href="https://www.bing.com/dict/search?q=${item.word}" target="_blank">必应词典</a>
        </div>
        <svg class="delete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;

      // 删除单词事件
      const deleteIcon = card.querySelector('.delete-icon');
      deleteIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteWord(item.word);
      });

      wordGrid.appendChild(card);
    });
  }

  // 删除单个单词
  function deleteWord(word) {
    chrome.storage.local.get({ vocabulary: {} }, (result) => {
      const vocab = result.vocabulary;
      delete vocab[word];
      chrome.storage.local.set({ vocabulary: vocab }, () => {
        loadVocabulary(); // 重新加载
      });
    });
  }

  // --- Flashcard Logic ---

  function startFlashcards() {
    if (vocabulary.length === 0) {
      fcContent.textContent = "无单词";
      return;
    }
    currentCardIndex = 0;
    showCard(currentCardIndex);
  }

  function showCard(index) {
    if (index >= vocabulary.length) {
      currentCardIndex = 0; // Loop back
    }
    const wordObj = vocabulary[currentCardIndex];
    fcContent.textContent = wordObj.word;
  }

  fcNext.addEventListener('click', () => {
    if (vocabulary.length === 0) return;
    currentCardIndex++;
    if (currentCardIndex >= vocabulary.length) currentCardIndex = 0;
    showCard(currentCardIndex);
  });

  // 点击卡片跳转到翻译
  flashcard.addEventListener('click', () => {
    if (vocabulary.length === 0) return;
    const word = vocabulary[currentCardIndex].word;
    window.open(`https://www.bing.com/dict/search?q=${word}`, '_blank');
  });

});