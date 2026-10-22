/**
 * Gemini client used by every AI endpoint.
 *  - Calls the REST generateContent API with the key from the environment (never logged).
 *  - Supports structured output (responseJsonSchema) and optional Google Search grounding.
 *  - Tries several models and gives every failure a stable error code the app can explain.
 *  - Thinking is switched off by default: on current models "thinking" tokens count against
 *    maxOutputTokens, which truncated structured replies and added latency.
 */
const BASE_URL = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
// Free-tier quotas are per model and per day, so spreading across several models gives far more capacity.
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];
const MODELS = Array.from(new Set([process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(Boolean)));
const THINKING_BUDGET = Number.isFinite(Number(process.env.GEMINI_THINKING_BUDGET)) ? Number(process.env.GEMINI_THINKING_BUDGET) : 0;

/** Error with a stable machine-readable code. Codes: NO_KEY, RATE_LIMIT, BUSY, TIMEOUT, BLOCKED, BAD_OUTPUT, UPSTREAM. */
class AiError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

/** Models that just ran out of quota are skipped for a while instead of being hit again. */
const cooldownUntil = new Map();
/** Models that rejected the thinkingConfig option (some "lite" models do) are called without it. */
const noThinkingConfig = new Set();
const resetModelState = () => {
  cooldownUntil.clear();
  noThinkingConfig.clear();
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hasKey = () => Boolean(process.env.GEMINI_API_KEY);

/** Keeps only well-formed http(s) links, de-duplicated. */
function safeUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Reads citation sources from a candidate's groundingMetadata (the sources the API actually returned). */
function extractSources(candidate) {
  const chunks = (candidate && candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) || [];
  const seen = new Set();
  const sources = [];
  for (const chunk of chunks) {
    const web = chunk && chunk.web;
    const url = web && safeUrl(web.uri);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: String((web.title || new URL(url).hostname)).slice(0, 120), url });
    if (sources.length >= 8) break;
  }
  return sources;
}

async function callModel(model, { system, contents, schema, grounded, maxOutputTokens, temperature, attemptTimeoutMs = 25_000 }) {
  const generationConfig = { maxOutputTokens, temperature };
  if (!noThinkingConfig.has(model)) generationConfig.thinkingConfig = { thinkingBudget: THINKING_BUDGET };
  // Structured output and search grounding are not combined: that pairing is a Gemini 3 preview feature.
  if (schema && !grounded) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseJsonSchema = schema;
  }
  const body = { contents, generationConfig };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (grounded) body.tools = [{ google_search: {} }];

  let response;
  try {
    response = await fetch(`${BASE_URL}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(attemptTimeoutMs),
    });
  } catch (err) {
    throw new AiError('TIMEOUT', `${model}: request failed (${err.name})`, true);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const status = response.status;
    // 400 with a thinking option: retry this model once without it, and remember that for next time.
    if (status === 400 && generationConfig.thinkingConfig) {
      noThinkingConfig.add(model);
      return callModel(model, { system, contents, schema, grounded, maxOutputTokens, temperature, attemptTimeoutMs });
    }
    if (status === 429) {
      // Daily quota: skip this model for hours. Per-minute limit: skip it for a minute.
      // Tracked per mode: on a real key the search-grounding quota can be exhausted while plain answers still work.
      cooldownUntil.set(`${model}|${grounded ? 'g' : 'p'}`, Date.now() + (/PerDay/i.test(detail) ? 6 * 3600_000 : 60_000));
    }
    const code = status === 429 ? 'RATE_LIMIT' : status === 503 || status === 500 || status === 502 || status === 504 ? 'BUSY' : 'UPSTREAM';
    // 404 means this model name is not available to the key: try the next one.
    // 400 here means this particular model rejected the request (e.g. a schema feature it lacks): try the next model.
    throw new AiError(code, `${model}: HTTP ${status} ${detail.replace(/\s+/g, ' ').slice(0, 120)}`, [400, 404, 429, 500, 502, 503, 504].includes(status));
  }
  const data = await response.json();
  if (data.promptFeedback && data.promptFeedback.blockReason) {
    throw new AiError('BLOCKED', `${model}: blocked (${data.promptFeedback.blockReason})`, false);
  }
  const candidate = (data.candidates || [])[0];
  const text = ((candidate && candidate.content && candidate.content.parts) || []).map((p) => p.text || '').join('');
  if (!text) throw new AiError('BAD_OUTPUT', `${model}: no text (finishReason ${candidate && candidate.finishReason})`, true);
  return { text, sources: grounded ? extractSources(candidate) : [], model };
}

/**
 * Runs a request across the model list. Busy models (503) get up to `rounds` passes with a pause;
 * rate limits (429) are never hammered: each model is tried once, then the error is returned.
 */
async function generate(opts, { deadlineMs = 60_000, rounds = 2 } = {}) {
  if (!hasKey()) throw new AiError('NO_KEY', 'GEMINI_API_KEY is not set');
  const startedAt = Date.now();
  let lastError;
  for (let round = 0; round < rounds; round++) {
    let sawBusy = false;
    for (const model of MODELS) {
      if (Date.now() - startedAt > deadlineMs) throw lastError || new AiError('TIMEOUT', 'deadline exceeded', false);
      if ((cooldownUntil.get(`${model}|${opts.grounded ? 'g' : 'p'}`) || 0) > Date.now()) {
        lastError = lastError || new AiError('RATE_LIMIT', `${model}: skipped (quota cooldown)`, true);
        continue;
      }
      try {
        return await callModel(model, opts);
      } catch (err) {
        lastError = err instanceof AiError ? err : new AiError('UPSTREAM', String(err.message), false);
        console.error('[gemini]', lastError.code, lastError.message.slice(0, 160));
        if (!lastError.retryable) throw lastError;
        if (lastError.code === 'BUSY' || lastError.code === 'TIMEOUT') sawBusy = true;
      }
    }
    if (!sawBusy) break; // only rate limits / missing models: waiting will not help
    await sleep(2000 * (round + 1));
  }
  throw lastError;
}

/** Parses JSON text from the model, tolerating code fences. Throws BAD_OUTPUT on failure. */
function parseJson(text) {
  const cleaned = String(text).replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new AiError('BAD_OUTPUT', 'model did not return JSON', true);
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new AiError('BAD_OUTPUT', 'model returned malformed JSON', true);
  }
}

module.exports = { AiError, generate, parseJson, hasKey, extractSources, safeUrl, MODELS, resetModelState };
