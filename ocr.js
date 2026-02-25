/**
 * OCR Module using Tesseract.js
 * Extracts scores from racketlon scoresheets
 */

let tesseractWorker = null;
let tesseractLoaded = false;

/**
 * Load Tesseract.js dynamically
 */
async function loadTesseract() {
  if (tesseractLoaded) {
    return true;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = () => {
      tesseractLoaded = true;
      resolve(true);
    };
    script.onerror = () => reject(new Error("Failed to load Tesseract.js"));
    document.head.appendChild(script);
  });
}

/**
 * Initialize the Tesseract worker
 */
async function initWorker(onProgress) {
  if (tesseractWorker) {
    return tesseractWorker;
  }

  await loadTesseract();

  tesseractWorker = await Tesseract.createWorker("fra+eng", 1, {
    logger: (m) => {
      if (onProgress && m.status) {
        onProgress(m.status, m.progress || 0);
      }
    },
  });

  return tesseractWorker;
}

/**
 * Perform OCR on an image
 * @param {HTMLImageElement|File|string} image - Image to process
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<string>} - Extracted text
 */
async function performOCR(image, onProgress = null) {
  const worker = await initWorker(onProgress);
  const result = await worker.recognize(image);
  return result.data.text;
}

/**
 * Parse OCR text to extract racketlon scores
 * Looks for patterns like:
 * - "21-15" or "21 - 15"
 * - Player names followed by scores
 * - Table format with sports as headers
 *
 * @param {string} text - OCR text output
 * @returns {Object} - Parsed scores and player names
 */
function parseRacketlonScores(text) {
  const result = {
    playerA: null,
    playerB: null,
    scores: {
      tabletennis: null,
      badminton: null,
      squash: null,
      tennis: null,
    },
    raw: text,
    confidence: 0,
  };

  // Clean the text
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Try to find score patterns
  const scorePattern = /(\d{1,2})\s*[-–—]\s*(\d{1,2})/g;
  const allScores = [];

  for (const line of lines) {
    let match;
    while ((match = scorePattern.exec(line)) !== null) {
      const score1 = parseInt(match[1], 10);
      const score2 = parseInt(match[2], 10);

      // Filter out unrealistic scores (0-99 but likely 0-30 for racketlon)
      if (score1 <= 35 && score2 <= 35) {
        allScores.push({
          text: `${score1}-${score2}`,
          score1,
          score2,
          line,
        });
      }
    }
  }

  // Try to identify sports from context
  const sportPatterns = [
    {
      sport: "tabletennis",
      patterns: ["ping", "pong", "table", "tennis de table", "tt", "tenis de mesa"],
    },
    { sport: "badminton", patterns: ["bad", "badminton", "shuttle"] },
    { sport: "squash", patterns: ["squash", "sq"] },
    { sport: "tennis", patterns: ["tennis", "ten"] },
  ];

  // Try to match scores to sports
  const textLower = text.toLowerCase();

  for (const { sport, patterns } of sportPatterns) {
    for (const pattern of patterns) {
      const idx = textLower.indexOf(pattern);
      if (idx !== -1) {
        // Look for a score near this sport name
        const nearbyText = text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + 50));
        const scoreMatch = nearbyText.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/);
        if (scoreMatch && !result.scores[sport]) {
          result.scores[sport] = `${scoreMatch[1]}-${scoreMatch[2]}`;
          result.confidence += 0.25;
        }
      }
    }
  }

  // If we couldn't match sports but have 4 scores, assume they're in order
  if (Object.values(result.scores).every((s) => s === null) && allScores.length >= 4) {
    const sports = ["tabletennis", "badminton", "squash", "tennis"];
    for (let i = 0; i < Math.min(4, allScores.length); i++) {
      result.scores[sports[i]] = allScores[i].text;
    }
    result.confidence = 0.5; // Lower confidence for assumed order
  }

  // Try to find player names
  // Look for patterns like "Name1 vs Name2" or names at the start of rows
  const vsMatch = text.match(
    /([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)\s*(?:vs?\.?|contre|[-–—])\s*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)/i,
  );
  if (vsMatch) {
    result.playerA = vsMatch[1].trim();
    result.playerB = vsMatch[2].trim();
  }

  // Calculate confidence based on found scores
  const foundScores = Object.values(result.scores).filter((s) => s !== null).length;
  if (foundScores > 0) {
    result.confidence = Math.max(result.confidence, foundScores * 0.25);
  }

  return result;
}

/**
 * Full OCR pipeline for racketlon scoresheet
 */
async function ocrRacketlonSheet(image, onProgress = null) {
  const text = await performOCR(image, onProgress);
  return parseRacketlonScores(text);
}

// Export for use in app
if (typeof module !== "undefined" && module.exports) {
  module.exports = { performOCR, parseRacketlonScores, ocrRacketlonSheet, initWorker };
}
