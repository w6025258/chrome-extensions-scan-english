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