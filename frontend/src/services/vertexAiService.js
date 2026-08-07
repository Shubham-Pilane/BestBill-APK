// Vertex AI Gemini 2.5 Flash service using Google Service Account credentials

const SERVICE_ACCOUNT = {
  project_id: "gen-lang-client-0105687096",
  client_email: "rehab-poc-3@gen-lang-client-0105687096.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCqDYOARUNSb+19\nUIXdlmOSPsp0N1EH3av6cmrY1XSQ7EBMRzGsrXcYvH6tlYWD1LhFxIFr3OZALNyL\n37j725HRrq7jVuu1RHZ9eugYJDkDrSqgnW80dr5jnFJGADqeWQ7P8hAKLIxctMxD\n7xqgEFo47qPvUH7Zt44TFveKf+fXqkq3OxCMoOAOjjl5/j+AArLm9GO2TnKlAwOG\nAHtLf3iFq8xCaGviLT/PnV1aDn7kcwa1zYgDuD3ipla0xcoCiilbn3ZOw/759Utf\nk6qzn6VRvt3oGaki1r6UJF/cXzrco+ZTiOVUOLUs1MyIxbIPc5TZ0EzQcqYbJziE\nMIgMwFxtAgMBAAECggEABkQ9YxSfrJHy2MIcThmMvaGCO5ej7QwHxSYtFqSrvmvH\nr80/gPXwfwZyjZ+GXiC7PK5HOFbEMREQ0eJn8ky5r4DbhtsCZc7qJel0VEVrc3L7\ncJP0pTngqLzkkZn7DwWdpInupOKri9QJeKcUSQST6pKtaF7ZRIPS4L8L1rxWv8Ks\n8ql2fOSwUo14kdSOZdK3Z38v6n8fTQTu7GwTGnZHJFZ3/idfQ4S9l5ZJjQIBmG4P\njSDt2ehPwbavn6foPB4yKKBYv/iazTdDg2O7vLQM1wpS58osD+9q226o1Oaq6F5c\n5qD9Hy/6eFRNiE+oVwUISuQM+etoJiLHo+yMI2CZoQKBgQDapACAHQzFKN6LFoW9\n5pSTUSD8ceSouwVyU+tpX8LtBW3wGToVDqvsLawF2HHpOsMVPZkHqNkQW5x/aURY\nbK3AI0P32q9xMhSGDhUAt+LfToymo6N1DJJTsRsOyHBglaRN/I8BS0ZexuFCzU/W\nHchWj6QLRFnz0e/Lz4qMnqxdIQKBgQDHHCIozOAleL+cy76DV+1sa/11oOUEodLR\n2EGETyRn0cwapx+4R1q7FLE0q+icgbMgEC0wgn+r8rSmyjwavej13cVE4RBvYK37\nKL8tqQtS90M3kIbKYmC00goKIXB3o9pH5SSwOeiBxdgQLooCfeLBJYoyBXY1RYXa\ndxheJF+pzQKBgBYkV7yhtIJfAjKZxE+YA2Hr7GhEbIC99+49G3EfdpEkZJ7VHzG0\nu6p+cZZh9h9FiS4kf9PrwJfMf0vT8Ez4LJxxtddq+SuAg92TnYLmHH666LmThuE6\ntbLuE6xqlh7h6LLRKfZaljTQ9U0bl8M6XuiNQXK2qFlt4FgGm6RkCVahAoGAdggF\nb+5TiaMU45wcKbw78KPrsolYefB8Cw2JeSd5S1ohBkPAF/ukm3ZevfySfgSc7Qrp\n3vHdQU81LBKCos+lg+qdgIFyvrOvL04uVqD5J4uQeyXf4aWD8mz4qpy8ERA+25PI\ntfb+D7/6n00XXvbFLv5T9+co9ddqy+EBvv0NAJkCgYAHFJfA0eEGgV4UqH9rXvXc\n28ZnFG3VL/TtVPo5JlQuhIZDro3OrqqzfuKo/bEE0q6HhyF74Mrkru812+wXAJZu\nQQPpZrcPr6t7/II1sysqSC+WiaGPow4zxKMIgtCq9yi6AyVeOpDDA2hnjWXxm6IC\nSGsZR0STe1iYyTQY6Y2MZw==\n-----END PRIVATE KEY-----\n",
  token_uri: "https://oauth2.googleapis.com/token"
};

// Base64Url encoder helper
function base64url(source) {
  let encoded = btoa(source);
  encoded = encoded.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return encoded;
}

// Convert PEM string to CryptoKey for Web Crypto API
async function importPrivateKey(pem) {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
}

// Create Signed JWT Assertion for Google OAuth2 Token
async function createSignedJwt() {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    sub: SERVICE_ACCOUNT.client_email,
    aud: SERVICE_ACCOUNT.token_uri,
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/cloud-platform"
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const key = await importPrivateKey(SERVICE_ACCOUNT.private_key);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(unsignedToken)
  );

  const encodedSignature = base64url(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${unsignedToken}.${encodedSignature}`;
}

let cachedAccessToken = null;
let tokenExpiry = 0;

// Obtain Access Token using Google Service Account OAuth2 assertion
async function getAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

  try {
    const jwt = await createSignedJwt();
    const params = new URLSearchParams();
    params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    params.append('assertion', jwt);

    const res = await fetch(SERVICE_ACCOUNT.token_uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await res.json();
    if (data.access_token) {
      cachedAccessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
      return cachedAccessToken;
    }
  } catch (err) {
    console.warn('[VERTEX AI AUTH WARN]', err);
  }
  return null;
}

/**
 * Sends prompt to Google Vertex AI Gemini 2.5 Flash model
 * Endpoint: https://us-central1-aiplatform.googleapis.com/v1/projects/gen-lang-client-0105687096/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent
 */
export async function queryVertexGemini25Flash(transcript, menuItems = [], availableTables = []) {
  const token = await getAccessToken();
  if (!token) return null;

  const menuListStr = menuItems.map(i => `${i.name} (ID: ${i.id})`).join(', ');
  const tableListStr = availableTables.map(t => `Table ${t.table_number}`).join(', ');

  const systemPrompt = `You are an intelligent Restaurant & Hotel POS Voice AI Assistant for "BestBill POS".
Parse multi-lingual voice commands (English, Hindi, Marathi, Hinglish) accurately into structured JSON actions.

Available Menu Items in Restaurant:
[${menuListStr}]

Available Active Tables:
[${tableListStr}]

SUPPORTED ACTIONS & RULES:
1. "GREETING":
   - User says hello, hi, namaste, namaskar, good morning, kem cho, kaise ho, kasa ahes, pranam, etc.
   - Return {"action": "GREETING", "reply": "Namaste! Main BestBill AI Assistant Hoon. Aap kya karna chahte hain?", "message": "Greeting"}

2. "ADD_ITEMS":
   - User orders one or multiple menu items for a table.
   - Match exact item names from available menu items list and parse quantities.
   - Example 1: "Add 2 Paneer Masala and 4 Roti to table 1" -> {"action": "ADD_ITEMS", "tableNumber": "1", "items": [{"name": "Paneer Masala", "quantity": 2}, {"name": "Roti", "quantity": 4}], "message": "Adding items to Table 1"}
   - Example 2: "table 4 pe 2 chicken thali aur 4 roti 1 butter naan add karo" -> {"action": "ADD_ITEMS", "tableNumber": "4", "items": [{"name": "Chicken Thali", "quantity": 2}, {"name": "Roti", "quantity": 4}, {"name": "Butter Naan", "quantity": 1}], "message": "Adding items to Table 4"}
   - Example 3 (Marathi): "table 2 var don paneer masala aani chaar roti taaka" -> {"action": "ADD_ITEMS", "tableNumber": "2", "items": [{"name": "Paneer Masala", "quantity": 2}, {"name": "Roti", "quantity": 4}], "message": "Adding items to Table 2"}

3. "PRINT_KOT":
   - User requests Kitchen Order Ticket (KOT), kitchen print, or speaks phonetic variations like "cute", "coat", "court", "security", "cat", "cut", "quote", "parchi", "kot print".
   - Example: "table 3 ka kot print nikalo" or "print cute for table 3" -> {"action": "PRINT_KOT", "tableNumber": "3", "items": [], "message": "Printing KOT for Table 3"}

4. "PRINT_BILL":
   - User requests final bill, check, receipt, hisab, khata, pavti.
   - Example: "table 2 ka final bill nikalo" -> {"action": "PRINT_BILL", "tableNumber": "2", "items": [], "message": "Printing bill for Table 2"}

5. "CLEAR_TABLE":
   - User requests to clear, empty, or clean table order (e.g. "clear table 4", "table 4 khali karo").
   - Example: "clear order on table 4" -> {"action": "CLEAR_TABLE", "tableNumber": "4", "items": [], "message": "Clearing Table 4"}

6. "SWAP_TABLE":
   - User requests to swap, move, or transfer order from source table to target table.
   - Example: "swap table 2 to table 5" or "table 2 se table 5 pe shift karo" -> {"action": "SWAP_TABLE", "sourceTableNumber": "2", "targetTableNumber": "5", "items": [], "message": "Swapping Table 2 to Table 5"}

STRICT OUTPUT JSON SCHEMA ONLY:
{
  "action": "GREETING" | "ADD_ITEMS" | "PRINT_KOT" | "PRINT_BILL" | "CLEAR_TABLE" | "SWAP_TABLE" | "UNKNOWN",
  "reply": string | null,
  "tableNumber": string | number | null,
  "sourceTableNumber": string | number | null,
  "targetTableNumber": string | number | null,
  "items": [
    {
      "name": string,
      "id": string | number | null,
      "quantity": number
    }
  ],
  "message": string
}

Spoken voice input to parse: "${transcript}"`;

  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 600,
          responseMimeType: "application/json"
        }
      })
    });

    const result = await response.json();
    const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText) {
      return JSON.parse(candidateText);
    }
  } catch (err) {
    console.error('[VERTEX GEMINI 2.5 FLASH ERROR]', err);
  }
  return null;
}
