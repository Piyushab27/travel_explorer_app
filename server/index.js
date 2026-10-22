/**
 * Roam India AI server.
 *
 * A small dependency-free Node server that sits between the mobile app and the Gemini API so the
 * API key never ships inside the app. Every endpoint validates its input, limits request size and
 * frequency, asks Gemini for structured JSON, and validates the reply before returning it.
 *
 * Run:   GEMINI_API_KEY=... node server/index.js     (or put the key in .env and run `npm run server`)
 * Env:   GEMINI_API_KEY          required for AI features (free key: https://aistudio.google.com/apikey)
 *        GEMINI_MODEL            optional model tried first (busy/missing models fall back automatically)
 *        GEMINI_THINKING_BUDGET  optional, default 0 (thinking off: faster, cheaper, no truncated JSON)
 *        PORT                    optional, default 8787
 *        RATE_LIMIT_PER_MIN      optional, default 20 AI requests per IP per minute
 *
 * Endpoints (all JSON):
 *   GET  /api/health
 *   POST /api/chat                 conversational concierge (+ grounded research when freshness matters)
 *   POST /api/match                explains the app's shortlisted destinations for a traveller
 *   POST /api/itinerary            generate a day-by-day itinerary
 *   POST /api/itinerary/revise     change one activity, one day or the whole plan
 *   POST /api/itinerary/explain    explain the reasoning behind a plan
 *   POST /api/budget               natural-language budget -> editable estimate (the app adds up the totals)
 */
const http = require('http');
const crypto = require('crypto');
const { AiError, generate, parseJson, hasKey, MODELS } = require('./gemini');
const S = require('./schemas');
const P = require('./prompts');

const PORT = Number(process.env.PORT) || 8787;
const MAX_BODY = 60_000;
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN) || 20;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 60;

// ---------- small helpers ----------
const s = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const sList = (v, maxItems, maxLen) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, maxItems).map((x) => x.trim().slice(0, maxLen)) : []);
const int = (v, min, max) => (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max ? Math.round(Number(v)) : null);
const ID = /^[a-z0-9-]{1,40}$/;

class BadRequest extends Error {}

function send(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY) {
        reject(new BadRequest('Request too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// ---------- rate limiting (per IP, sliding window, in memory) ----------
const hits = new Map();
function rateLimited(ip, now = Date.now()) {
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return Math.ceil((60_000 - (now - recent[0])) / 1000);
  }
  recent.push(now);
  hits.set(ip, recent);
  return 0;
}

// ---------- tiny response cache: identical requests are answered without another Gemini call ----------
const cache = new Map();
function cacheGet(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  cache.delete(key);
  return undefined;
}
function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
}
const hash = (route, body) => route + ':' + crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

// ---------- input cleaning (whitelists only; anything else is dropped) ----------
function cleanContext(c) {
  c = c && typeof c === 'object' ? c : {};
  return {
    destinationId: ID.test(c.destinationId || '') ? c.destinationId : '',
    destination: s(c.destination, 80),
    days: int(c.days, 1, 60),
    budgetInr: int(c.budgetInr, 0, 100_000_000),
    travelers: int(c.travelers, 1, 30),
    style: s(c.style, 20),
    budgetLevel: s(c.budgetLevel, 20),
    interests: sList(c.interests, 10, 30),
    month: s(c.month, 20),
    startCity: s(c.startCity, 60),
    facts: s(c.facts, 2000),
    itinerarySummary: s(c.itinerarySummary, 2500),
  };
}

function cleanAllowed(list) {
  return (Array.isArray(list) ? list : [])
    .filter((d) => d && ID.test(d.id || ''))
    .slice(0, 40)
    .map((d) => ({ id: d.id, name: s(d.name, 60) }));
}

/** Questions whose answers depend on current or checkable facts get Google Search grounding. */
const FRESH = /\b(visa|e-?visa|entry requirement|passport|immigration|advisory|advisories|exchange rate|currency|open (now|today)|opening hours|timings|ticket price|entry fee|current|latest|today|this week|news|strike|festival dates?|closed|permit)\b/i;
const needsFreshInfo = (text) => FRESH.test(text);

function cleanItinerary(it) {
  // Re-validate any itinerary the client sends back so the model never sees unchecked data.
  try {
    return S.validateItinerary(it, null);
  } catch {
    throw new BadRequest('Invalid itinerary');
  }
}

const itinerarySummary = (it) =>
  it.days.map((d) => `Day ${d.day} ${d.title}: ${d.activities.map((a) => `[${a.time}] ${a.text}`).join(' | ')}`).join('\n').slice(0, 5000);

// ---------- route handlers ----------
const routes = {};

routes['POST /api/chat'] = async (body) => {
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, text: m.text.trim().slice(0, 1500) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') throw new BadRequest('Send a message first.');
  const ctx = cleanContext(body.context);
  const allowed = cleanAllowed(body.allowedDestinations);
  const contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));
  const contextBlock = `\n\nCONTEXT (data about the active trip, may be partly empty):\n${JSON.stringify(ctx)}\nALLOWED_DESTINATIONS: ${JSON.stringify(allowed)}`;
  const lastText = messages[messages.length - 1].text;

  // 1) Grounded research when freshness matters (best effort; falls back honestly).
  let researchNote = null;
  if (body.forceResearch === true || needsFreshInfo(lastText)) {
    try {
      const out = await generate(
        { system: P.CHAT_GROUNDED + contextBlock, contents, grounded: true, maxOutputTokens: 2500, temperature: 0.3, attemptTimeoutMs: 25_000 },
        { deadlineMs: 45_000, rounds: 1 },
      );
      return {
        reply: out.text.replace(/\r/g, '').trim().slice(0, 4000),
        followUps: [],
        destinationIds: [],
        needsMoreInfo: false,
        research: { used: true, unavailable: false, sources: out.sources },
      };
    } catch (err) {
      if (!(err instanceof AiError)) throw err;
      researchNote = err.code; // continue with a clearly labelled, unverified answer
    }
  }

  // 2) Normal structured answer.
  const system = P.CHAT + contextBlock + (researchNote
    ? '\n\nLIVE RESEARCH IS UNAVAILABLE right now. Answer from general knowledge only, say clearly near the start that this is NOT verified against current official sources, and tell the traveller which official website to check.'
    : '');
  const out = await generate({ system, contents, schema: S.chatSchema, maxOutputTokens: 2500, temperature: 0.6, attemptTimeoutMs: 18_000 }, { deadlineMs: 55_000, rounds: 1 });
  const chat = S.validateChat(parseJson(out.text), allowed.map((d) => d.id));
  return { ...chat, research: { used: false, unavailable: Boolean(researchNote), sources: [] } };
};

routes['POST /api/match'] = async (body) => {
  const p = body.prefs && typeof body.prefs === 'object' ? body.prefs : {};
  const prefs = {
    experience: s(p.theme, 20), budget: s(p.budget, 20), duration: s(p.duration, 20), style: s(p.style, 20),
    interests: sList(p.interests, 10, 30), startCity: s(p.startCity, 60), month: s(p.month, 20), notes: s(p.notes, 200),
  };
  if (!prefs.experience) throw new BadRequest('Pick a preferred experience first.');
  const candidates = (Array.isArray(body.candidates) ? body.candidates : []).slice(0, 8).filter((c) => c && ID.test(c.id || '')).map((c) => ({
    id: c.id, name: s(c.name, 60), category: s(c.category, 20), theme: s(c.theme, 20),
    budgets: sList(c.budgets, 3, 20), suggestedDays: s(c.suggestedDays, 20), bestTime: s(c.bestTime, 80),
    styles: sList(c.styles, 4, 20), experiences: sList(c.experiences, 8, 160), tip: s(c.tip, 200),
  }));
  if (!candidates.length) throw new BadRequest('No candidates.');
  const key = hash('match', { prefs, candidates });
  const hit = cacheGet(key);
  if (hit) return { ...hit, cached: true };
  const out = await generate({
    system: P.MATCH,
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({ TRAVELLER: prefs, CANDIDATES: candidates }) }] }],
    schema: S.matchSchema, maxOutputTokens: 3000, temperature: 0.5,
  }, { deadlineMs: 45_000 });
  const result = S.validateMatch(parseJson(out.text), candidates.map((c) => c.id));
  cacheSet(key, result);
  return result;
};

routes['POST /api/itinerary'] = async (body) => {
  const destination = s(body.destination, 80);
  const days = int(body.days, 1, 14);
  if (!destination) throw new BadRequest('Please enter a destination.');
  if (!days) throw new BadRequest('Days must be between 1 and 14.');
  const request = {
    destination, days, month: s(body.month, 20), budget: s(body.budget, 20), style: s(body.style, 20),
    interests: sList(body.interests, 10, 30), preferHiddenGems: Boolean(body.preferHiddenGems),
    notes: s(body.notes, 400), travelers: int(body.travelers, 1, 30), budgetInr: int(body.budgetInr, 0, 100_000_000),
    startCity: s(body.startCity, 60), knownFacts: s(body.knownFacts, 2500),
  };
  const key = hash('itinerary', request);
  const hit = cacheGet(key);
  if (hit) return { itinerary: hit, cached: true };
  const out = await generate({
    system: P.ITINERARY,
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(request) }] }],
    schema: S.itinerarySchema, maxOutputTokens: 8000, temperature: 0.7, attemptTimeoutMs: 40_000,
  }, { deadlineMs: 85_000, rounds: 1 });
  const itinerary = S.validateItinerary(parseJson(out.text), days);
  cacheSet(key, itinerary);
  return { itinerary };
};

routes['POST /api/itinerary/revise'] = async (body) => {
  const itinerary = cleanItinerary(body.itinerary);
  const instruction = s(body.instruction, 300);
  if (!instruction) throw new BadRequest('Tell the planner what to change.');
  const scope = body.dayIndex != null ? `Only change day ${int(body.dayIndex, 1, 14)}.` : '';
  const activity = body.activityIndex != null ? ` Only replace activity number ${int(body.activityIndex, 1, 6)} of that day.` : '';
  const out = await generate({
    system: P.REVISE,
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({ ITINERARY: itinerary, INSTRUCTION: instruction + ' ' + scope + activity, FACTS: s(body.facts, 1500) }) }] }],
    schema: S.itinerarySchema, maxOutputTokens: 8000, temperature: 0.6, attemptTimeoutMs: 40_000,
  }, { deadlineMs: 85_000, rounds: 1 });
  return { itinerary: S.validateItinerary(parseJson(out.text), itinerary.days.length) };
};

routes['POST /api/itinerary/explain'] = async (body) => {
  const itinerary = cleanItinerary(body.itinerary);
  const key = hash('explain', itinerary);
  const hit = cacheGet(key);
  if (hit) return { explanation: hit, cached: true };
  const out = await generate({
    system: P.EXPLAIN,
    contents: [{ role: 'user', parts: [{ text: itinerarySummary(itinerary) + '\n' + JSON.stringify({ assumptions: itinerary.budgetAssumptions }) }] }],
    maxOutputTokens: 1200, temperature: 0.5,
  }, { deadlineMs: 45_000 });
  const explanation = out.text.replace(/\r/g, '').trim().slice(0, 2500);
  cacheSet(key, explanation);
  return { explanation };
};

routes['POST /api/budget'] = async (body) => {
  const text = s(body.text, 600);
  if (!text) throw new BadRequest('Describe your budget first, for example "₹25,000 for 4 days in Goa".');
  // Saved trip details are only hints. What the traveller typed always wins (see the BUDGET prompt).
  const request = {
    TRAVELLER_TEXT: text,
    TRIP_CONTEXT_HINTS: { destination: s(body.destination, 80), days: int(body.days, 1, 60), travelers: int(body.travelers, 1, 30), totalInr: int(body.totalInr, 0, 100_000_000) },
  };
  const key = hash('budget', request);
  const hit = cacheGet(key);
  if (hit) return { budget: hit, cached: true };
  const out = await generate({
    system: P.BUDGET,
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(request) }] }],
    schema: S.budgetSchema, maxOutputTokens: 3000, temperature: 0.4, attemptTimeoutMs: 25_000,
  }, { deadlineMs: 55_000, rounds: 1 });
  const budget = S.validateBudget(parseJson(out.text));
  cacheSet(key, budget);
  return { budget };
};

// ---------- user-facing messages for each failure code ----------
const ERRORS = {
  NO_KEY: [503, 'The AI features are not configured on the server (missing GEMINI_API_KEY).'],
  RATE_LIMIT: [429, 'The AI service is at its usage limit right now. Please wait a minute and try again.'],
  BUSY: [503, 'The AI service is busy. Please try again in a moment.'],
  TIMEOUT: [504, 'The AI service took too long to answer. Please try again.'],
  BLOCKED: [422, 'The AI could not answer that request. Try rephrasing it.'],
  BAD_OUTPUT: [502, 'The AI sent an unusable answer. Please try again.'],
  UPSTREAM: [502, 'The AI service returned an error. Please try again.'],
};

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const path = (req.url || '').split('?')[0];
  const route = `${req.method} ${path}`;
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (route === 'GET /api/health') {
      return send(res, 200, { ai: hasKey(), models: MODELS, limits: { requestsPerMinute: RATE_LIMIT, maxBodyBytes: MAX_BODY } });
    }
    const handler = routes[route];
    if (!handler) return send(res, 404, { error: 'Not found' });

    const retry = rateLimited(req.socket.remoteAddress || 'unknown');
    if (retry) return send(res, 429, { error: 'Too many requests. Please slow down.', code: 'RATE_LIMIT', retryAfterSec: retry }, { 'Retry-After': String(retry) });
    if (!hasKey()) return send(res, ERRORS.NO_KEY[0], { error: ERRORS.NO_KEY[1], code: 'NO_KEY' });

    let body;
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch (err) {
      if (err instanceof BadRequest) return send(res, 413, { error: 'Request too large.', code: 'BAD_REQUEST' });
      return send(res, 400, { error: 'Invalid JSON.', code: 'BAD_REQUEST' });
    }
    return send(res, 200, await handler(body && typeof body === 'object' ? body : {}));
  } catch (err) {
    if (err instanceof BadRequest) return send(res, 400, { error: err.message, code: 'BAD_REQUEST' });
    if (err instanceof AiError) {
      const [status, message] = ERRORS[err.code] || ERRORS.UPSTREAM;
      return send(res, status, { error: message, code: err.code });
    }
    console.error('[server] unexpected error:', err && err.message);
    return send(res, 500, { error: 'Something went wrong on the server.', code: 'SERVER' });
  } finally {
    // Never log request bodies, messages or keys: only method, path and timing.
    if (req.method !== 'OPTIONS') console.log(`${route} ${res.statusCode} ${Date.now() - started}ms`);
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Roam India server on http://localhost:${PORT} (AI ${hasKey() ? 'enabled' : 'DISABLED: set GEMINI_API_KEY'})`);
  });
}

module.exports = { server, rateLimited, needsFreshInfo, cleanContext };
