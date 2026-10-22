/**
 * Roam India itinerary server.
 *
 * A tiny, dependency-free Node server that asks a real Gemini model to write an itinerary.
 * It exists so the API key stays on the server and never ships inside the mobile app.
 *
 * Run:   GEMINI_API_KEY=... node server/index.js
 * Env:   GEMINI_API_KEY    required for AI itineraries (free keys: https://aistudio.google.com/apikey)
 *        GEMINI_MODEL      optional, defaults to gemini-3.8-flash (model names change; see ai.google.dev/gemini-api/docs/models)
 *        GEMINI_BASE_URL   optional, defaults to https://generativelanguage.googleapis.com
 *        PORT              optional, defaults to 8787
 *
 * Endpoints:
 *   GET  /api/health      -> { ai: boolean, model: string }
 *   POST /api/itinerary   -> { itinerary }  (or { error } with a non-2xx status)
 */
const http = require('http');

const PORT = Number(process.env.PORT) || 8787;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const BASE_URL = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
const API_KEY = () => process.env.GEMINI_API_KEY;
const MAX_BODY = 20_000;

const SYSTEM_PROMPT = `You are a careful, practical India travel planner inside a mobile app.
Write a day-by-day itinerary as JSON ONLY (no markdown, no commentary) with exactly this shape:
{
  "title": string,
  "summary": string,
  "days": [ { "day": number, "title": string, "activities": [ { "time": "Morning" | "Afternoon" | "Evening", "text": string, "mapQuery": string } ] } ],
  "tips": string[],
  "caveats": string
}
Rules:
- Produce exactly the requested number of days, each with 2 to 4 activities.
- Use only real, well-known places in or near the destination. Never invent businesses, restaurants or hotels. If you recommend food or cafes, describe the kind of place or a well-known area instead of naming a specific business.
- Do NOT state exact prices, opening hours, distances or travel times unless the user's "knownFacts" provide them. Say "check locally" when unsure.
- "mapQuery" is a short Google Maps search phrase such as "Hawa Mahal, Jaipur".
- Respect the traveller's budget, travel style, interests, month and notes. If "preferHiddenGems" is true, favour lesser-known places over the most crowded ones.
- If the destination is unclear or not in India, still return valid JSON with a short summary explaining that in "caveats" and an empty "days" array.
- "caveats" must remind the traveller to verify timings, permits, prices and weather before travelling.`;

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY) {
        reject(new Error('Request too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/** Keeps the request small and well-typed before it reaches the model. */
function validate(input) {
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const list = (v, maxItems, maxLen) =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, maxItems).map((x) => x.slice(0, maxLen)) : [];
  const destination = str(input.destination, 80);
  const days = Math.round(Number(input.days));
  if (!destination) return { error: 'Please enter a destination.' };
  if (!Number.isFinite(days) || days < 1 || days > 14) return { error: 'Days must be between 1 and 14.' };
  return {
    value: {
      destination,
      days,
      month: str(input.month, 20),
      budget: str(input.budget, 20),
      style: str(input.style, 20),
      interests: list(input.interests, 10, 30),
      preferHiddenGems: Boolean(input.preferHiddenGems),
      notes: str(input.notes, 400),
      knownFacts: str(input.knownFacts, 2500),
    },
  };
}

/** Pulls the first JSON object out of the model reply, tolerating code fences. */
function parseJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Makes sure the shape is safe for the app to render. */
function normalise(raw) {
  const days = Array.isArray(raw.days) ? raw.days : [];
  return {
    title: String(raw.title || 'Your trip'),
    summary: String(raw.summary || ''),
    days: days.map((d, i) => ({
      day: Number(d.day) || i + 1,
      title: String(d.title || `Day ${i + 1}`),
      activities: (Array.isArray(d.activities) ? d.activities : []).map((a) => ({
        time: ['Morning', 'Afternoon', 'Evening'].includes(a.time) ? a.time : 'Morning',
        text: String(a.text || ''),
        mapQuery: a.mapQuery ? String(a.mapQuery) : '',
      })),
    })),
    tips: (Array.isArray(raw.tips) ? raw.tips : []).map(String),
    caveats: String(raw.caveats || 'Verify timings, permits, prices and weather before you travel.'),
  };
}

async function generate(request) {
  const response = await fetch(`${BASE_URL}/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': API_KEY() },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(request) }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4000, temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const hint = response.status === 404 ? ` (is GEMINI_MODEL "${MODEL}" available to your key?)` : '';
    throw new Error(`Gemini API error ${response.status}${hint}: ${detail.slice(0, 200)}`);
  }
  const data = await response.json();
  if (data.promptFeedback && data.promptFeedback.blockReason) {
    throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
  }
  const candidate = (data.candidates || [])[0];
  const text = ((candidate && candidate.content && candidate.content.parts) || []).map((p) => p.text || '').join('');
  if (!text) throw new Error(`Gemini returned no text (finishReason: ${candidate && candidate.finishReason})`);
  return normalise(parseJson(text));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/api/health') {
    return send(res, 200, { ai: Boolean(API_KEY()), model: MODEL });
  }
  if (req.method === 'POST' && req.url === '/api/itinerary') {
    if (!API_KEY()) {
      return send(res, 503, { error: 'The AI planner is not configured on the server (missing GEMINI_API_KEY).' });
    }
    try {
      const parsed = JSON.parse((await readBody(req)) || '{}');
      const checked = validate(parsed);
      if (checked.error) return send(res, 400, { error: checked.error });
      const itinerary = await generate(checked.value);
      return send(res, 200, { itinerary });
    } catch (err) {
      console.error('[itinerary]', err.message);
      return send(res, 502, { error: 'The AI planner could not create an itinerary. Please try again.' });
    }
  }
  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Roam India server on http://localhost:${PORT} (AI ${API_KEY() ? 'enabled' : 'DISABLED: set GEMINI_API_KEY'})`);
});
