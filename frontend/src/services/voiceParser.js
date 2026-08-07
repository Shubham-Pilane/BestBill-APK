import { queryVertexGemini25Flash } from './vertexAiService';

/**
 * Text-to-Speech (TTS) Voice Synthesis for hands-free audio responses.
 */
export function speakText(text = '', lang = 'hi-IN') {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel(); // Stop any previous ongoing speech
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = lang || 'hi-IN';

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith((lang || 'hi').split('-')[0].toLowerCase())) || voices[0];
        if (matchingVoice) utterance.voice = matchingVoice;
      }

      window.speechSynthesis.speak(utterance);
    }, 200);
  } catch (err) {
    console.warn('[SPEECH SYNTHESIS ERR]', err);
  }
}

/**
 * Normalizes string for fuzzy matching (lowercasing & space/special char stripping)
 */
function cleanStr(str = '') {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Enhanced Local Voice Parser supporting English, Hindi, and Marathi commands.
 * Commands Supported: GREETING, PRINT_KOT, PRINT_BILL, CLEAR_TABLE, SWAP_TABLE, ADD_ITEMS.
 */
export function parseVoiceCommandLocally(transcript = '', menuItems = [], availableTables = []) {
  const text = transcript.toLowerCase().trim();
  if (!text) {
    return { action: 'UNKNOWN', message: 'Empty voice transcript' };
  }

  // 0. Greeting Detection (English, Hindi, Marathi)
  const isGreeting = /\b(?:hello|hi|hey|namaste|namaskar|good morning|good evening|kem cho|kaise ho|kasa ahes|ram ram|pranam)\b/i.test(text);
  if (isGreeting && text.length < 30 && !/(?:table|bill|kot|item|order|add)/i.test(text)) {
    let reply = "Namaste! Main BestBill AI Assistant Hoon. Aap kya karna chahte hain?";
    let lang = 'hi-IN';
    if (/(?:hello|hi|hey|good morning|good evening)/i.test(text)) {
      reply = "Hello! I am BestBill AI Assistant. How can I help you today?";
      lang = 'en-US';
    } else if (/(?:namaskar|kasa ahes)/i.test(text)) {
      reply = "Namaskar! Me BestBill AI Assistant Aahe. Sangal kay madat karu?";
      lang = 'mr-IN';
    }
    return {
      action: 'GREETING',
      reply,
      lang,
      message: reply
    };
  }

  // 1. Table Extraction (Source & Target for Swap, or Single Table)
  let tableNumbersFound = [];
  const matches = text.matchAll(/(?:table|tbl|tble|tb|tabel|\b)\s*(\d+)/gi);
  for (const m of matches) {
    if (m[1]) tableNumbersFound.push(m[1]);
  }

  const primaryTable = tableNumbersFound[0] || (availableTables[0]?.table_number || '1');

  // 2. SWAP TABLE Intent Detection
  const isSwapKeyword = /(?:swap|move|shift|transfer|badla)\b/i.test(text);
  if (isSwapKeyword) {
    const sourceTable = tableNumbersFound[0] || '1';
    const targetTable = tableNumbersFound[1] || '2';
    return {
      action: 'SWAP_TABLE',
      sourceTableNumber: sourceTable,
      targetTableNumber: targetTable,
      message: `Swap Table ${sourceTable} to Table ${targetTable}`
    };
  }

  // 3. CLEAR TABLE Intent Detection
  const isClearKeyword = /(?:clear|khali|clean|empty|cancel)\b/i.test(text);
  const isKotKeyword = /(?:kot|k\.o\.t|kitchen|cute|coat|court|cut|quote|cat|got|secuirty|security|kod|chapo|pathwa|taka|parchi|ticket)\b/i.test(text);
  const isBillKeyword = /(?:bill|final bill|hisab|khata|paise|checkout|billing|pavti)\b/i.test(text);

  if (isClearKeyword && !isKotKeyword && !isBillKeyword) {
    return {
      action: 'CLEAR_TABLE',
      tableNumber: primaryTable,
      message: `Clear Table ${primaryTable}`
    };
  }

  // 4. PRINT_KOT Intent Detection (Prioritized for mishearings: "cute", "security", "court", etc.)
  if (isKotKeyword && !isBillKeyword) {
    return {
      action: 'PRINT_KOT',
      tableNumber: primaryTable,
      items: [],
      message: `Print KOT for Table ${primaryTable}`
    };
  }

  // 5. PRINT_BILL Intent Detection
  if (isBillKeyword) {
    return {
      action: 'PRINT_BILL',
      tableNumber: primaryTable,
      items: [],
      message: `Print Bill for Table ${primaryTable}`
    };
  }

  // 6. ADD_ITEMS Intent Parsing (English, Hindi, Marathi Number Parsing & Item Matching)
  const wordToNum = {
    // English
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    // Hindi & Marathi
    'ek': 1, 'don': 2, 'do': 2, 'teen': 3, 'tin': 3,
    'char': 4, 'chaar': 4, 'paanch': 5, 'paach': 5,
    'chah': 6, 'saha': 6, 'saat': 7, 'sat': 7,
    'aath': 8, 'at': 8, 'nau': 9, 'nav': 9, 'das': 10, 'daha': 10
  };

  let normalizedText = text;
  Object.keys(wordToNum).forEach(word => {
    const reg = new RegExp(`\\b${word}\\b`, 'gi');
    normalizedText = normalizedText.replace(reg, wordToNum[word]);
  });

  const itemsFound = [];
  menuItems.forEach(item => {
    const itemNameClean = cleanStr(item.name);
    if (!itemNameClean) return;

    const textClean = cleanStr(normalizedText);

    if (textClean.includes(itemNameClean) || normalizedText.includes(item.name.toLowerCase())) {
      const itemEscaped = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const qtyRegexBefore = new RegExp(`(\\d+)\\s*(?:x|quantity|qty|plate|half|full|dya|taaka)?\\s*${itemEscaped}`, 'i');
      const qtyRegexAfter = new RegExp(`${itemEscaped}\\s*(\\d+)`, 'i');

      let qty = 1;
      const matchBefore = normalizedText.match(qtyRegexBefore);
      const matchAfter = normalizedText.match(qtyRegexAfter);

      if (matchBefore) {
        qty = parseInt(matchBefore[1], 10);
      } else if (matchAfter) {
        qty = parseInt(matchAfter[1], 10);
      }

      itemsFound.push({
        name: item.name,
        id: item.id,
        quantity: qty
      });
    }
  });

  if (itemsFound.length > 0) {
    return {
      action: 'ADD_ITEMS',
      tableNumber: primaryTable,
      items: itemsFound,
      message: `Found ${itemsFound.length} item(s) to add to Table ${primaryTable}`
    };
  }

  return {
    action: 'UNKNOWN',
    tableNumber: primaryTable,
    items: [],
    message: "Could not recognize command."
  };
}

/**
 * Main Voice Assistant Parser
 * Tries Vertex AI Gemini 2.5 Flash first, then falls back to Local Parser
 */
export async function processVoiceCommand(transcript, menuItems = [], availableTables = []) {
  if (!transcript || !transcript.trim()) {
    return { action: 'UNKNOWN', message: 'No speech transcript' };
  }

  try {
    const aiResult = await queryVertexGemini25Flash(transcript, menuItems, availableTables);
    if (aiResult && aiResult.action && aiResult.action !== 'UNKNOWN') {
      return aiResult;
    }
  } catch (err) {
    console.warn('[VERTEX AI FALLBACK ACTIVATED]', err);
  }

  return parseVoiceCommandLocally(transcript, menuItems, availableTables);
}
