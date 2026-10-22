/**
 * Roam India itinerary server.
 *
 * A tiny, dependency-free Node server that asks a real Claude model to write an itinerary.
 * It exists so the API key stays on the server and never ships inside the mobile app.
 *
 * Run:   ANTHROPIC_API_KEY=sk-ant-... node server/index.js
 * Env:   ANTHROPIC_API_KEY   required for AI itineraries
 *        ANTHROPIC_MODEL     optional, defaults to claude-sonnet-5-5
 *        ANTHROPIC_BASE_URL  optional, defaults to https://api.anthropic.com
 *        PORT                optional, defaults to 8787
 *
 * Endpoints:
 *   GET  /api/health      -> { ai: boolean, model: string }
 *   POST /api/itinerary   -> { itinerary }  (or { error } with a non-2xx status)
 */
const http = require('http');

const PORT = Number(process.env.PORT) || 8787;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const BASE_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
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
  const response = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(request) }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Model API error ${response.status}: ${detail.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return normalise(parseJson(text));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/api/health') {
    return send(res, 200, { ai: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL });
  }
  if (req.method === 'POST' && req.url === '/api/itinerary') {
    if (!process.env.ANTHROPIC_API_KEY) {
      return send(res, 503, { error: 'The AI planner is not configured on the server (missing ANTHROPIC_API_KEY).' });
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
  console.log(`Roam India server on http://localhost:${PORT} (AI ${process.env.ANTHROPIC_API_KEY ? 'enabled' : 'DISABLED: set ANTHROPIC_API_KEY'})`);
});
