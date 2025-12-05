
/**
 * content.js
 * 运行在网页上。负责分析页面单词并与扩展 Popup 通信。
 */

// 防止重复注入监听器
if (!window.hasVocabHelperListener) {
  window.hasVocabHelperListener = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ANALYZE_PAGE") {
      // 收到分析页面的请求
      const result = analyzePageWords();
      sendResponse(result);
    }
  });

  // 页面加载完成后，检查是否开启了自动采集
  checkAndAutoCollect();
}

function checkAndAutoCollect() {
  // 默认为 true (开启)
  chrome.storage.local.get({ autoCollect: true }, (result) => {
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
    const MAX_LEARNING_WORDS = 1000;
    
    // 计算当前生词本(learning)的数量
    let learningCount = 0;
    Object.values(vocab).forEach(item => {
      if (!item.status || item.status === 'learning') {
        learningCount++;
      }
    });
    
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
        // 检查生词本容量上限
        if (learningCount >= MAX_LEARNING_WORDS) {
            return; // 生词本满了就不加了
        }
        
        vocab[item.word] = {
          word: item.word,
          count: item.count,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'learning'
        };
        // 增加计数，确保本次循环后续的新词能正确判断是否超限
        learningCount++;
      }
    });

    chrome.storage.local.set({ vocabulary: vocab });
  });
}

/**
 * 判断是否为“像样”的英语单词
 * 用于过滤代码变量、乱码、非单词缩写等
 */
function isLikelyRealWord(word) {
  // 1. 长度限制 (太长的通常是拼接词或垃圾数据)
  if (word.length > 30) return false;

  // 2. 连续重复字符不能超过2个 (如: coool, hhh)
  if (/(.)\1\1/.test(word)) return false;

  // 3. 必须包含至少一个元音 (a, e, i, o, u, y)
  // 过滤掉如 "html", "jpg", "src", "btn", "css" 等缩写
  if (!/[aeiouyAEIOUY]/.test(word)) return false;

  // 4. 驼峰命名过滤 (CamelCase)
  // 单词中间出现大写字母，通常是代码变量 (e.g. "myWord", "getElementById")
  // 允许全大写 (HTML) 或首字母大写 (English)
  // 逻辑：如果有一个小写字母后面紧跟着一个大写字母，认为是驼峰
  if (/[a-z][A-Z]/.test(word)) return false;

  return true;
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
    // 预校验：过滤掉看起来不正常的单词
    if (!isLikelyRealWord(word)) return;

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
