
/**
 * Test Harness for Real Page Scraping
 * Simulates content.js logic on real text from W3C.org
 */

// --- MOCK DATA (Text from W3C.org) ---
const MOCK_PAGE_TEXT = `
Making the web work
Working with stakeholders of the web
A range of organizations join the World Wide Web Consortium as Members to work with us to drive the direction of core web technologies and exchange ideas with industry and research leaders. We rotate randomly a few of our Member organizations' logos underneath.
The Web Consortium and its members, with help from the public and the web community, focus on a range of business ecosystems that the web transforms, including E-commerce, Media & Entertainment, Publishing and several other areas.
Discover how W3C supports these organizations

W3C 30th anniversary
1 October 2024 was W3C's 30th anniversary. We celebrated at our annual TPAC our three decades, advances in the web, the impact of our standards on the world, imagined a bright future, and enjoyed ourselves at an authentic evening of talks and a gala.
TPAC, our major annual event, gathers our community for thought-provoking discussions and coordinated work to advance the invaluable work of our Groups, and resolve challenging technical and social issues that the web faces.
TPAC brings together W3C Members and technical groups, the Board of Directors, the Advisory Board, and the Technical Architecture Group.
W3C@30 video & mementos

Web standards
Web standards are the building blocks of a consistent digitally connected world. They are implemented in browsers, blogs, search engines, and other software that power our experience on the web.
W3C is an international community where Members, full-time staff, and the public work together to develop web standards.
Learn more about web standards

Get involved
W3C works at the nexus of core technology, industry needs, and societal needs. Everyone can get involved with the work we do.
There are many ways individuals and organizations can participate in the Web Consortium to advance web standardization.
Ways to get involved

Latest news
Latest entries from across our News, Press Releases or Blog.
- TPAC 2025 Breakouts recap
This post gives highlights about the kind of breakout sessions held at TPAC 2025 and the improvements made this time.
Blog

- Updated Candidate Recommendation: CSS Color Adjustment Module Level 1
This module introduces a model and controls over automatic color adjustment by the user agent to handle user preferences, such as "Dark Mode", contrast adjustment, or specific desired color schemes.
News

- Group Note Draft: RDF 1.2 Interoperability
The goal of this specification is to provide guidance and good practices to achieve interoperability across different versions or profiles of RDF.
News

- Happy holidays from the World Wide Web Consortium!
News
`;

// --- LOGIC FROM content.js ---

function singularize(word) {
  const lower = word.toLowerCase();
  
  // 1. Ignore short words 
  if (lower.length <= 3) return lower; 

  // 2. Ends in 'ies' -> 'y'
  if (lower.endsWith('ies')) {
      return lower.slice(0, -3) + 'y';
  }

  // 3. Ends in 's'
  if (lower.endsWith('s')) {
      if (lower.endsWith('ss') || lower.endsWith('us') || lower.endsWith('is')) {
          return lower;
      }
      return lower.slice(0, -1);
  }
  
  return lower;
}

function isLikelyRealWord(word) {
  if (word.length > 30) return false;
  if (/(.)\1\1/.test(word)) return false;
  if (!/[aeiouyAEIOUY]/.test(word)) return false;
  if (/[a-z][A-Z]/.test(word)) return false;
  return true;
}

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

function analyzePageWords(text) {
  const words = text.match(/\b[a-zA-Z]+(['-][a-zA-Z]+)*\b/g) || [];

  const frequency = {};
  const rejected = [];
  
  words.forEach(word => {
    // 1. Structure check
    if (!isLikelyRealWord(word)) {
        rejected.push(`${word} (structure)`);
        return;
    }

    let lower = word.toLowerCase();
    
    // 2. Length check
    if (lower.length < 2) {
        rejected.push(`${word} (length)`);
        return;
    }
    
    // 3. Stop word check
    if (stopWords.has(lower)) {
        rejected.push(`${word} (stopword)`);
        return;
    }

    // 4. Singularize (New!)
    const singular = singularize(lower);
    
    // 5. Re-check Stop Word (Optional but safer)
    // E.g. "needs" -> "need" (maybe stopword?)
    if (stopWords.has(singular)) {
         rejected.push(`${word} (singular->stopword)`);
         return;
    }
    
    frequency[singular] = (frequency[singular] || 0) + 1;
  });

  const sortedList = Object.keys(frequency).map(word => ({
    word: word,
    count: frequency[word]
  })).sort((a, b) => b.count - a.count);

  return {
    totalDetected: words.length,
    validCount: sortedList.length,
    rejectedCount: rejected.length,
    list: sortedList,
    rejectedSample: rejected.slice(0, 20)
  };
}

// --- EXECUTION ---

console.log("Analyzing W3C Homepage Text (With Singularization)...\n");
const result = analyzePageWords(MOCK_PAGE_TEXT);

console.log(`Total Words Detected: ${result.totalDetected}`);
console.log(`Valid Words (After Filter): ${result.validCount}`);
console.log(`Rejected Words: ${result.rejectedCount}\n`);

console.log("--- Top 10 Valid Words ---");
result.list.slice(0, 10).forEach((item, i) => {
    console.log(`${i+1}. ${item.word} (${item.count})`);
});
console.log("...");
