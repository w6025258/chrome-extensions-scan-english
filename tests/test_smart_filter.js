
/**
 * Test Harness for Smart Filtering Logic
 * Copies logic from content.js to verify robustness.
 */

// --- LOGIC FROM content.js START ---

// Extraction Regex (Simulating content.js extraction)
// Matches words starting with letters, allowing internal hyphens/apostrophes
const EXTRACTION_REGEX = /\b[a-zA-Z]+(['-][a-zA-Z]+)*\b/;

function isLikelyRealWord(word) {
  // 1. Length limit
  if (word.length > 30) return false;

  // 2. Repeated chars > 2
  if (/(.)\1\1/.test(word)) return false;

  // 3. Must contain vowels
  if (!/[aeiouyAEIOUY]/.test(word)) return false;

  // 4. CamelCase filter
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

function analyzeWord(word) {
    // 0. Extraction Check (New!)
    // If the regex doesn't match the whole word, it wouldn't have been picked up from the page.
    const match = word.match(EXTRACTION_REGEX);
    if (!match || match[0] !== word) {
        return { valid: false, reason: "Regex mismatch (ignored by extractor)" };
    }

    // 1. Pre-check
    if (!isLikelyRealWord(word)) return { valid: false, reason: "Not a real word" };

    const lower = word.toLowerCase();
    
    // 2. Length check
    if (lower.length < 2) return { valid: false, reason: "Too short" };
    
    // 3. Stop word check
    if (stopWords.has(lower)) return { valid: false, reason: "Stop word" };

    return { valid: true, reason: "Pass" };
}

// --- LOGIC END ---

// --- TESTS ---

const testCases = [
    // Real Words
    { word: "apple", expected: true },
    { word: "Beauty", expected: true },
    { word: "HELLO", expected: true },
    
    // Hyphenated Words (Requested)
    { word: "co-operate", expected: true },
    { word: "well-known", expected: true },
    { word: "mother-in-law", expected: true },
    
    // Underscore / Snake_Case (Requested)
    // These fail because the extraction regex only allows a-z and ' -
    { word: "user_name", expected: false }, 
    { word: "api_response_data", expected: false },
    
    // Mixed / Edge
    { word: "re-enter", expected: true },
    { word: "-start", expected: false }, // Regex expects word char start
    { word: "end-", expected: false }, // Regex expects word char end (checked by match[0] !== word logic strictly essentially)
    
    // Length
    { word: "a", expected: false }, // too short
    { word: "supercalifragilisticexpialidocioussupercalifragilisticexpialidocious", expected: false }, // > 30

    // Repeated Chars
    { word: "coool", expected: false }, 
    { word: "better", expected: true }, // double is fine
    { word: "baaaad", expected: false }, // triple is bad
    
    // Vowels
    { word: "html", expected: false },
    { word: "jpg", expected: false },
    { word: "rhythm", expected: true }, // 'y' is vowel checking
    { word: "try", expected: true }, 

    // CamelCase
    { word: "myVariable", expected: false },
    { word: "getElementById", expected: false },
    { word: "iPhone", expected: false }, // i[P]hone - camelCase
    { word: "McDonald", expected: false }, // M[c]D[o]... wait. Mc[D]onald. c->D is small->big. Should fail.
    
    // Stop Words
    { word: "the", expected: false },
    { word: "The", expected: false }, // case insensitive
    { word: "AND", expected: false },
    { word: "is", expected: false },
    { word: "are", expected: false },
];

console.log("Running Smart Filter Tests (Updated with Regex & Special Chars)...\n");

let passed = 0;
let failed = 0;

testCases.forEach(tc => {
    const res = analyzeWord(tc.word);
    if (res.valid === tc.expected) {
        console.log(`[PASS] ${tc.word}: ${res.valid} (${res.reason})`);
        passed++;
    } else {
        console.error(`[FAIL] ${tc.word}: Expected ${tc.expected}, got ${res.valid} (${res.reason})`);
        failed++;
    }
});

console.log(`\nResult: ${passed}/${testCases.length} passed.`);

if (failed > 0) process.exit(1);
