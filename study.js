/**
 * study.js
 */

document.addEventListener("DOMContentLoaded", () => {
  const MAX_LEARNING_WORDS = 1000;

  const wordGrid = document.getElementById("word-grid");
  const clearLearningBtn = document.getElementById("clear-learning");
  const clearMasteredBtn = document.getElementById("clear-mastered");
  const clearIgnoredBtn = document.getElementById("clear-ignored");

  const resetCountBtn = document.getElementById("reset-count-btn");
  const toggleBatchBtn = document.getElementById("toggle-batch");
  const batchArea = document.getElementById("batch-area");
  const batchInput = document.getElementById("batch-input");
  const cancelBatchBtn = document.getElementById("cancel-batch");
  const confirmBatchBtn = document.getElementById("confirm-batch");
  const limitWarning = document.getElementById("limit-warning");
  const vocabCountEl = document.getElementById("vocab-count");

  const tabs = document.querySelectorAll(".tab");
  const tabLearning = document.getElementById("tab-learning");
  const tabMastered = document.getElementById("tab-mastered");
  const tabIgnored = document.getElementById("tab-ignored");
  const tabFlashcard = document.getElementById("tab-flashcard");
  const tabSpelling = document.getElementById("tab-spelling");

  // Chart Elements
  const barLearning = document.getElementById("bar-learning");
  const barMastered = document.getElementById("bar-mastered");
  const barIgnored = document.getElementById("bar-ignored");

  const sortSelect = document.getElementById("sort-select");
  const sortWrapper = document.getElementById("sort-wrapper");

  // View Containers
  const flashcardView = document.getElementById("flashcard-view");
  const listView = document.getElementById("list-view");
  const spellingView = document.getElementById("spelling-view");

  // Flashcard elements
  const fcContent = document.getElementById("fc-content");
  const fcTranslation = document.getElementById("fc-translation");
  const fcDont = document.getElementById("fc-dont");
  const fcKnow = document.getElementById("fc-know");
  const flashcard = document.getElementById("flashcard");
  const fcAudioBtn = document.getElementById("fc-audio-btn");
  const fcExternalLink = document.getElementById("fc-external-link");

  // Spelling elements
  const spMeaning = document.getElementById("sp-meaning");
  const spMask = document.getElementById("sp-mask");
  const spInput = document.getElementById("sp-input");
  const spFeedback = document.getElementById("sp-feedback");
  const spHintBtn = document.getElementById("sp-hint-btn");
  const spSubmitBtn = document.getElementById("sp-submit-btn");
  const spNextBtn = document.getElementById("sp-next-btn");

  let fullVocabulary = {}; // Map: word -> object
  let currentTabStatus = "learning"; // 'learning', 'mastered', 'ignored'

  // Flashcard state
  let currentCardIndex = 0;
  let learningList = []; // Array for flashcards
  const translationCache = {}; // Cache for API responses

  // Spelling state
  let spellingList = [];
  let currentSpellingIndex = 0;
  let isSpellingCorrect = false;
  let currentMaskIndices = new Set(); // indices of letters already revealed

  // 初始化
  loadVocabulary();

  // 批量添加 UI 切换
  toggleBatchBtn.addEventListener("click", () => {
    batchArea.style.display =
      batchArea.style.display === "block" ? "none" : "block";
  });
  cancelBatchBtn.addEventListener("click", () => {
    batchArea.style.display = "none";
    batchInput.value = "";
  });

  // 批量添加逻辑
  confirmBatchBtn.addEventListener("click", () => {
    const text = batchInput.value;
    if (!text.trim()) return;

    const words = text.match(/\b[a-zA-Z]+(['-][a-zA-Z]+)*\b/g) || [];
    if (words.length === 0) return;

    // 计算当前的生词数
    let learningCount = 0;
    Object.values(fullVocabulary).forEach((v) => {
      if (!v.status || v.status === "learning") learningCount++;
    });

    if (learningCount >= MAX_LEARNING_WORDS) {
      alert(
        `生词本已达到 ${MAX_LEARNING_WORDS} 词上限，无法添加新词。(已学会和已忽略的词不占用此额度)`
      );
      return;
    }

    let addedCount = 0;
    words.forEach((rawWord) => {
      // 过滤异常单词
      if (!isLikelyRealWord(rawWord)) return;

      const word = rawWord.toLowerCase();
      if (word.length < 2) return;

      if (!fullVocabulary[word]) {
        // 检查上限
        if (learningCount >= MAX_LEARNING_WORDS) {
          return;
        }

        fullVocabulary[word] = {
          word: word,
          count: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: "learning",
        };
        addedCount++;
        learningCount++; // 实时增加计数
      } else {
        fullVocabulary[word].count += 1;
        fullVocabulary[word].updatedAt = Date.now();
      }
    });

    saveVocabulary(() => {
      alert(`成功添加/更新了 ${addedCount} 个单词。`);
      batchArea.style.display = "none";
      batchInput.value = "";
      loadVocabulary();
    });
  });

  // 通用清空函数
  function clearByStatus(status, label) {
    const itemsToDelete = Object.values(fullVocabulary).filter((item) => {
      const s = item.status || "learning";
      return s === status;
    });

    if (itemsToDelete.length === 0) {
      alert(`“${label}”列表已经是空的。`);
      return;
    }

    if (
      confirm(
        `确定要清空“${label}”列表吗？(共 ${itemsToDelete.length} 个单词)\n此操作无法撤销。`
      )
    ) {
      // 重建对象，过滤掉目标状态的词
      const newVocab = {};
      Object.values(fullVocabulary).forEach((item) => {
        const s = item.status || "learning";
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

  clearLearningBtn.addEventListener("click", () =>
    clearByStatus("learning", "生词本")
  );
  clearMasteredBtn.addEventListener("click", () =>
    clearByStatus("mastered", "已学会")
  );
  clearIgnoredBtn.addEventListener("click", () =>
    clearByStatus("ignored", "已忽略")
  );

  // 重置计数
  resetCountBtn.addEventListener("click", () => {
    if (
      confirm(
        "确定要将所有单词（包括生词、学会、忽略）的出现频率计数重置为 0 吗？"
      )
    ) {
      Object.values(fullVocabulary).forEach((word) => {
        word.count = 0;
      });
      saveVocabulary(() => {
        renderList();
        alert("所有计数已重置。");
      });
    }
  });

  sortSelect.addEventListener("change", renderList);

  // Tab 切换
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const target = tab.dataset.target;
      const status = tab.dataset.status;

      // Reset views
      listView.style.display = "none";
      flashcardView.style.display = "none";
      spellingView.style.display = "none";
      sortWrapper.style.display = "none";

      if (target === "list-view") {
        currentTabStatus = status;
        listView.style.display = "block";
        sortWrapper.style.display = "flex";
        renderList();
      } else if (target === "flashcard-view") {
        flashcardView.style.display = "flex";
        startFlashcards();
      } else if (target === "spelling-view") {
        spellingView.style.display = "flex";
        startSpelling();
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

    Object.values(fullVocabulary).forEach((item) => {
      const s = item.status || "learning";
      if (s === "learning") learningCount++;
      else if (s === "mastered") masteredCount++;
      else if (s === "ignored") ignoredCount++;
    });

    // 更新 Tab 显示
    if (tabLearning) tabLearning.textContent = `生词本 (${learningCount})`;
    if (tabMastered) tabMastered.textContent = `已学会 (${masteredCount})`;
    if (tabIgnored) tabIgnored.textContent = `已忽略 (${ignoredCount})`;
    if (tabFlashcard) tabFlashcard.textContent = `单词卡片 (${learningCount})`;

    // 更新头部总容量显示 (改为只显示生词本容量)
    vocabCountEl.textContent = `${learningCount}/${MAX_LEARNING_WORDS} (生词)`;
    vocabCountEl.style.color =
      learningCount >= MAX_LEARNING_WORDS ? "#ef4444" : "#6b7280";

    if (learningCount >= MAX_LEARNING_WORDS) {
      limitWarning.style.display = "inline";
    } else {
      limitWarning.style.display = "none";
    }

    // 更新图表 (Chart)
    if (totalCount === 0) {
      barLearning.style.width = "0%";
      barMastered.style.width = "0%";
      barIgnored.style.width = "0%";
    } else {
      const learningPct = ((learningCount / totalCount) * 100).toFixed(1);
      const masteredPct = ((masteredCount / totalCount) * 100).toFixed(1);
      const ignoredPct = ((ignoredCount / totalCount) * 100).toFixed(1);

      barLearning.style.width = `${learningPct}%`;
      barMastered.style.width = `${masteredPct}%`;
      barIgnored.style.width = `${ignoredPct}%`;

      barLearning.title = `生词本: ${learningCount} (占总数 ${learningPct}%)`;
      barMastered.title = `已学会: ${masteredCount} (占总数 ${masteredPct}%)`;
      barIgnored.title = `已忽略: ${ignoredCount} (占总数 ${ignoredPct}%)`;
    }
  }

  function renderList() {
    wordGrid.innerHTML = "";

    // 筛选当前 Tab 状态的词
    let list = Object.values(fullVocabulary).filter((item) => {
      const status = item.status || "learning";
      return status === currentTabStatus;
    });

    if (list.length === 0) {
      const statusMap = {
        learning: "生词本",
        mastered: "已学会",
        ignored: "已忽略",
      };
      wordGrid.innerHTML = `<div class="empty-vocab">“${statusMap[currentTabStatus]}”列表为空。</div>`;
      return;
    }

    // 排序
    const sortType = sortSelect.value;
    list.sort((a, b) => {
      if (sortType === "frequency") return b.count - a.count;
      if (sortType === "alpha") return a.word.localeCompare(b.word);
      return b.updatedAt - a.updatedAt;
    });

    list.forEach((item) => {
      const card = document.createElement("div");
      card.className = "word-card";

      const date = new Date(item.updatedAt).toLocaleDateString();

      // 状态切换按钮
      let statusActionsHtml = "";
      if (currentTabStatus === "learning") {
        statusActionsHtml = `
            <div class="icon-btn btn-master" title="标记为已学会" data-action="master">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="icon-btn btn-ignore" title="忽略/垃圾数据" data-action="ignore">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
            </div>
          `;
      } else if (currentTabStatus === "mastered") {
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l6 6"></path><path d="M4 14h6"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="M22 22l-5-10-5 10"></path><path d="M14 18h6"></path></svg>
          </div>
          <a class="icon-btn" href="https://translate.google.com/?sl=en&tl=zh-CN&text=${item.word}&op=translate" target="_blank" title="打开 Google 翻译">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </div>
      `;

      // 绑定事件
      card.querySelectorAll(".icon-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const action = btn.dataset.action;
          if (!action) return;

          if (action === "speak") {
            playAudio(item.word);
          } else if (action === "translate") {
            toggleBubbleTranslation(
              item.word,
              card.querySelector(".trans-bubble"),
              btn
            );
          } else if (action === "master") {
            changeStatus(item.word, "mastered");
          } else if (action === "ignore") {
            changeStatus(item.word, "ignored");
          } else if (action === "restore") {
            changeStatus(item.word, "learning");
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
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  async function toggleBubbleTranslation(word, bubbleEl, btnEl) {
    if (bubbleEl.style.display === "block") {
      bubbleEl.style.display = "none";
      btnEl.classList.remove("active");
      return;
    }

    btnEl.classList.add("active");
    bubbleEl.style.display = "block";
    if (!bubbleEl.dataset.loaded) {
      bubbleEl.textContent = "加载中...";
      try {
        const trans = await fetchTranslation(word);
        bubbleEl.textContent = trans;
        bubbleEl.dataset.loaded = "true";
      } catch (err) {
        bubbleEl.textContent = "翻译失败";
      }
    }
  }

  // --- Flashcard Logic ---

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // 批量添加框时不触发
    if (batchArea.style.display === "block") return;

    // Flashcard View Shortcuts
    if (flashcardView.style.display !== "none") {
      switch (e.code) {
        case "Space":
          e.preventDefault();
          flashcard.click(); // Show translation
          break;
        case "ArrowRight":
          e.preventDefault();
          fcKnow.click(); // Mastered
          break;
        case "ArrowLeft":
          e.preventDefault();
          fcDont.click(); // Next
          break;
      }
    }

    // Spelling View Shortcuts
    if (spellingView.style.display !== "none") {
      if (e.code === "Enter") {
        e.preventDefault();
        // 如果已经答对并处于“等待跳转”状态，回车直接跳过等待
        if (isSpellingCorrect) {
          nextSpellingCard();
        } else {
          checkSpelling();
        }
      }
    }
  });

  function startFlashcards() {
    // Get all learning words and sort by frequency (or maybe random?)
    // Here we stick to frequency to learn most common words first.
    learningList = Object.values(fullVocabulary)
      .filter((item) => {
        const status = item.status || "learning";
        return status === "learning";
      })
      .sort((a, b) => b.count - a.count);

    if (learningList.length === 0) {
      fcContent.textContent = "生词本空空如也";
      fcTranslation.style.display = "none";
      fcKnow.style.display = "none";
      fcDont.style.display = "none";
      fcAudioBtn.style.display = "none";
      fcExternalLink.style.display = "none";
      return;
    } else {
      fcKnow.style.display = "inline-block";
      fcDont.style.display = "inline-block";
      fcAudioBtn.style.display = "flex";
      fcExternalLink.style.display = "inline-flex";
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
    fcTranslation.style.display = "none";
    fcTranslation.textContent = "";
  }

  // "我不会" -> 下一个
  fcDont.addEventListener("click", () => {
    if (learningList.length === 0) return;
    currentCardIndex++;
    if (currentCardIndex >= learningList.length) currentCardIndex = 0;
    showCard(currentCardIndex);
  });

  // "我学会了" -> 移出生词本
  fcKnow.addEventListener("click", () => {
    if (learningList.length === 0) return;
    const word = learningList[currentCardIndex].word;

    if (fullVocabulary[word]) {
      fullVocabulary[word].status = "mastered";
      fullVocabulary[word].updatedAt = Date.now();

      // Remove from current session list
      learningList.splice(currentCardIndex, 1);
      saveVocabulary();

      if (learningList.length === 0) {
        startFlashcards(); // Refresh to empty state
        return;
      }

      // Current index now points to the next card (because of splice),
      // so we check bounds but don't increment.
      if (currentCardIndex >= learningList.length) {
        currentCardIndex = 0;
      }
      showCard(currentCardIndex);
    }
  });

  // 卡片模式：朗读按钮
  fcAudioBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止触发翻转
    if (learningList.length > 0) {
      playAudio(learningList[currentCardIndex].word);
    }
  });

  // 卡片模式：点击卡片显示翻译
  flashcard.addEventListener("click", async (e) => {
    // 避免点到内部按钮或链接时触发
    if (
      e.target.closest("button") ||
      e.target.closest("a") ||
      e.target.closest(".icon-btn")
    )
      return;

    if (learningList.length === 0) return;

    const word = learningList[currentCardIndex].word;

    // Toggle logic
    if (fcTranslation.style.display === "block") {
      // Optional: Clicking again could hide it, but usually we just leave it open.
      // fcTranslation.style.display = 'none';
      return;
    }

    fcTranslation.textContent = "加载翻译中...";
    fcTranslation.style.display = "block";

    try {
      const trans = await fetchTranslation(word);
      fcTranslation.textContent = trans;
    } catch (err) {
      fcTranslation.textContent = "翻译失败";
    }
  });

  // --- Spelling Mode Logic ---

  function startSpelling() {
    spellingList = Object.values(fullVocabulary)
      .filter((item) => {
        // 只使用已经学会的单词进行拼写练习
        return item.status === "mastered";
      })
      .sort((a, b) => b.count - a.count);

    if (spellingList.length === 0) {
      spMeaning.textContent =
        "“已学会”列表为空，请先在生词本或卡片模式中标记单词为“会了”。";
      spInput.disabled = true;
      spMask.innerHTML = "";
      return;
    }

    spInput.disabled = false;
    currentSpellingIndex = 0;
    showSpellingCard(0);
  }

  async function showSpellingCard(index) {
    if (index >= spellingList.length) {
      currentSpellingIndex = 0;
    }

    const wordObj = spellingList[currentSpellingIndex];
    isSpellingCorrect = false;
    currentMaskIndices.clear();

    // Reset UI
    spInput.value = "";
    spInput.className = "sp-input"; // remove correct/wrong
    spInput.disabled = true; // disable until loaded
    spFeedback.textContent = "";
    spFeedback.className = "sp-feedback";
    spMeaning.textContent = "加载释义中...";

    // Render Mask (initial state: all hidden)
    renderMask(wordObj.word);

    // Load translation
    try {
      const trans = await fetchTranslation(wordObj.word);
      spMeaning.textContent = trans;
      spInput.disabled = false;
      spInput.focus();
    } catch (err) {
      spMeaning.textContent = "无法加载释义 (请检查网络)";
    }
  }

  function renderMask(word) {
    spMask.innerHTML = "";
    const chars = word.split("");
    chars.forEach((char, idx) => {
      const span = document.createElement("span");
      span.className = "mask-char";

      // 如果是空格或非字母符号，直接显示
      if (!/[a-zA-Z]/.test(char)) {
        span.textContent = char;
        span.classList.add("space"); // 简单的样式处理
        // 标记为已揭示，避免 hint 选中
        currentMaskIndices.add(idx);
      } else {
        // 如果已经在已揭示集合中，则显示字母
        if (currentMaskIndices.has(idx)) {
          span.textContent = char;
          span.classList.add("revealed");
        } else {
          // 否则显示下划线（CSS控制border-bottom，内容留空）
          span.textContent = "";
        }
      }
      spMask.appendChild(span);
    });
  }

  function checkSpelling() {
    if (spellingList.length === 0) return;
    const targetWord = spellingList[currentSpellingIndex].word.toLowerCase();
    const inputVal = spInput.value.trim().toLowerCase();

    if (!inputVal) return;

    if (inputVal === targetWord) {
      // Correct
      isSpellingCorrect = true;
      spInput.classList.remove("wrong");
      spInput.classList.add("correct");
      spFeedback.textContent = "回答正确!";
      spFeedback.className = "sp-feedback feedback-success";
      playAudio(targetWord);

      // Fully reveal mask
      const word = spellingList[currentSpellingIndex].word;
      for (let i = 0; i < word.length; i++) currentMaskIndices.add(i);
      renderMask(word);

      // Auto next after 1.5s
      setTimeout(() => {
        // 检查用户是否在此期间手动切走了
        if (isSpellingCorrect) {
          nextSpellingCard();
        }
      }, 1500);
    } else {
      // Wrong
      spInput.classList.add("wrong");
      spFeedback.textContent = "拼写错误，请重试";
      spFeedback.className = "sp-feedback feedback-error";

      // Remove shake animation class after it plays so it can be re-triggered
      setTimeout(() => {
        spInput.classList.remove("wrong");
      }, 500);
    }
  }

  function nextSpellingCard() {
    currentSpellingIndex++;
    if (currentSpellingIndex >= spellingList.length) {
      currentSpellingIndex = 0;
    }
    showSpellingCard(currentSpellingIndex);
  }

  spSubmitBtn.addEventListener("click", checkSpelling);

  spNextBtn.addEventListener("click", () => {
    // Skip logic: maybe reveal answer then move? Or just move.
    // Let's just move.
    nextSpellingCard();
  });

  spHintBtn.addEventListener("click", () => {
    if (spellingList.length === 0) return;
    const targetWord = spellingList[currentSpellingIndex].word;

    // 找出所有还未揭示的字母索引
    const hiddenIndices = [];
    for (let i = 0; i < targetWord.length; i++) {
      if (!currentMaskIndices.has(i) && /[a-zA-Z]/.test(targetWord[i])) {
        hiddenIndices.push(i);
      }
    }

    if (hiddenIndices.length > 0) {
      // 随机揭示一个
      const randomIdx = Math.floor(Math.random() * hiddenIndices.length);
      const idxToReveal = hiddenIndices[randomIdx];

      currentMaskIndices.add(idxToReveal);
      renderMask(targetWord);
      spInput.focus();
    }
  });

  // --- Shared Utilities ---

  async function fetchTranslation(word) {
    // Check Cache
    if (translationCache[word]) {
      return translationCache[word];
    }

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(
      word
    )}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      const result = data[0][0][0];
      translationCache[word] = result; // Save to cache
      return result;
    }
    return "未找到翻译";
  }

  function isLikelyRealWord(word) {
    if (word.length > 30) return false;
    if (/(.)\1\1/.test(word)) return false;
    if (!/[aeiouyAEIOUY]/.test(word)) return false;
    if (/[a-z][A-Z]/.test(word)) return false;
    return true;
  }
});
