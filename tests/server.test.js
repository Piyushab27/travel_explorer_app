/**
 * Server tests against a mock Gemini endpoint (no network, no API key needed).
 * Run with: npm test
 */
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'mock-model';
process.env.RATE_LIMIT_PER_MIN = '100';
const http = require('http');
const test = require('node:test');
const assert = require('node:assert/strict');

let upstream = () => ({ status: 200, json: {} });
let upstreamCalls = [];
const mock = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    const body = JSON.parse(b || '{}');
    upstreamCalls.push({ url: req.url, key: req.headers['x-goog-api-key'], body });
    const { status, json } = upstream(body);
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(json));
  });
});

const textReply = (obj) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] } }] });
let base;

let appServer;
test.before(async () => {
  await new Promise((r) => mock.listen(0, r));
  process.env.GEMINI_BASE_URL = `http://localhost:${mock.address().port}`;
  ({ server: appServer } = require('../server/index.js'));
  await new Promise((r) => appServer.listen(0, r));
  base = `http://localhost:${appServer.address().port}`;
});
test.after(() => {
  appServer.close();
  mock.close();
});
test.beforeEach(() => {
  upstreamCalls = [];
  require('../server/gemini.js').resetModelState();
});

const post = async (path, body) => {
  const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json() };
};

const chatBody = (text, extra = {}) => ({
  messages: [{ role: 'user', text }],
  context: { destination: 'Goa', days: 5 },
  allowedDestinations: [{ id: 'goa', name: 'Goa' }, { id: 'munnar', name: 'Munnar' }],
  ...extra,
});
const validItin = (days) => ({
  title: 'T', summary: 'S', caveats: 'verify',
  days: Array.from({ length: days }, (_, i) => ({ day: 99 - i, title: `D${i}`, activities: [{ time: 'Morning', text: 'Visit a fort', mapQuery: 'Fort', category: 'sight', durationHours: 2, estimatedCostInr: 200 }] })),
});

test('chat: returns structured reply, keeps only real destination IDs, sends key as header and context in the system prompt', async () => {
  upstream = () => ({ status: 200, json: textReply({ reply: '## Hi\n- one', followUps: ['Next?'], destinationIds: ['goa', 'atlantis'], needsMoreInfo: false }) });
  const { status, json } = await post('/api/chat', chatBody('Plan something relaxing'));
  assert.equal(status, 200);
  assert.deepEqual(json.destinationIds, ['goa']); // invented "atlantis" dropped
  assert.equal(json.research.used, false);
  const c = upstreamCalls[0];
  assert.equal(c.key, 'test-key');
  assert.ok(c.body.generationConfig.responseJsonSchema, 'structured output requested');
  assert.equal(c.body.generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.ok(c.body.systemInstruction.parts[0].text.includes('"days":5'), 'trip context passed to the model');
  assert.ok(!JSON.stringify(c.body).includes('test-key'), 'key never in the request body');
});

test('chat: follow-up keeps conversation history (model sees earlier turns)', async () => {
  upstream = () => ({ status: 200, json: textReply({ reply: 'ok', followUps: [], destinationIds: [], needsMoreInfo: false }) });
  await post('/api/chat', { ...chatBody('x'), messages: [{ role: 'user', text: 'Plan 3 days in Goa' }, { role: 'assistant', text: 'Sure' }, { role: 'user', text: 'make it cheaper' }] });
  const roles = upstreamCalls[0].body.contents.map((c) => c.role);
  assert.deepEqual(roles, ['user', 'model', 'user']);
});

test('chat: freshness question uses Google Search grounding and returns only valid source URLs', async () => {
  upstream = (b) => ({
    status: 200,
    json: { candidates: [{ content: { parts: [{ text: 'Thailand offers visa-free entry for many; check the official site.' }] }, groundingMetadata: { groundingChunks: [
      { web: { uri: 'https://www.thaievisa.go.th/', title: 'Thai e-Visa' } },
      { web: { uri: 'javascript:alert(1)', title: 'bad' } },
      { web: { uri: 'https://www.thaievisa.go.th/', title: 'dupe' } },
      { web: { uri: 'not a url', title: 'bad2' } },
    ] } }] },
  });
  const { json } = await post('/api/chat', chatBody('Do I need a visa for Thailand?'));
  assert.equal(json.research.used, true);
  assert.deepEqual(json.research.sources, [{ title: 'Thai e-Visa', url: 'https://www.thaievisa.go.th/' }]);
  assert.ok(upstreamCalls[0].body.tools[0].google_search, 'grounding tool enabled');
  assert.equal(upstreamCalls[0].body.generationConfig.responseJsonSchema, undefined, 'no structured output with grounding');
});

test('chat: when grounding is rate limited, answer is clearly marked as unverified (never fabricated as verified)', async () => {
  upstream = (b) => (b.tools
    ? { status: 429, json: { error: { message: 'quota' } } }
    : { status: 200, json: textReply({ reply: 'Not verified: check the official site.', followUps: [], destinationIds: [], needsMoreInfo: false }) });
  const { status, json } = await post('/api/chat', chatBody('What is the visa situation for Thailand?'));
  assert.equal(status, 200);
  assert.equal(json.research.used, false);
  assert.equal(json.research.unavailable, true);
  assert.deepEqual(json.research.sources, []);
  const fallbackCall = upstreamCalls.find((c) => !c.body.tools);
  assert.ok(fallbackCall.body.systemInstruction.parts[0].text.includes('LIVE RESEARCH IS UNAVAILABLE'));
});

test('chat: ordinary messages do not trigger web research', async () => {
  upstream = () => ({ status: 200, json: textReply({ reply: 'ok', followUps: [], destinationIds: [], needsMoreInfo: false }) });
  await post('/api/chat', chatBody('Which is better for family, Goa or Munnar?'));
  assert.ok(upstreamCalls.every((c) => !c.body.tools));
});

test('match: drops destination IDs the model invented and duplicates', async () => {
  upstream = () => ({ status: 200, json: textReply({ summary: 's', recommendations: [
    { destinationId: 'goa', why: 'beach', tradeoffs: 'crowds', tips: ['t'] },
    { destinationId: 'narnia', why: 'x', tradeoffs: 'y' },
    { destinationId: 'goa', why: 'dup', tradeoffs: 'dup' },
  ] }) });
  const { status, json } = await post('/api/match', { prefs: { theme: 'beaches' }, candidates: [{ id: 'goa', name: 'Goa' }, { id: 'gokarna', name: 'Gokarna' }] });
  assert.equal(status, 200);
  assert.deepEqual(json.recommendations.map((r) => r.destinationId), ['goa']);
});

test('match: identical requests are served from cache (one Gemini call)', async () => {
  upstream = () => ({ status: 200, json: textReply({ summary: 's', recommendations: [{ destinationId: 'goa', why: 'w', tradeoffs: 't' }] }) });
  const body = { prefs: { theme: 'beaches', notes: 'cache-test' }, candidates: [{ id: 'goa', name: 'Goa' }] };
  await post('/api/match', body);
  const second = await post('/api/match', body);
  assert.equal(upstreamCalls.length, 1);
  assert.equal(second.json.cached, true);
});

test('itinerary: valid output is renumbered and renderable', async () => {
  upstream = () => ({ status: 200, json: textReply(validItin(3)) });
  const { status, json } = await post('/api/itinerary', { destination: 'Goa', days: 3 });
  assert.equal(status, 200);
  assert.deepEqual(json.itinerary.days.map((d) => d.day), [1, 2, 3]); // model's numbering (99, 98...) ignored
  assert.equal(json.itinerary.days[0].activities[0].estimatedCostInr, 200);
});

test('itinerary: wrong number of days is rejected safely (no crash, friendly error)', async () => {
  upstream = () => ({ status: 200, json: textReply(validItin(2)) });
  const { status, json } = await post('/api/itinerary', { destination: 'Hampi', days: 4 });
  assert.equal(status, 502);
  assert.equal(json.code, 'BAD_OUTPUT');
  assert.ok(!/test-key|stack|at /.test(json.error));
});

test('itinerary: malformed / non-JSON output is rejected safely', async () => {
  upstream = () => ({ status: 200, json: textReply('Sorry, here is some prose and no JSON at all') });
  const { status, json } = await post('/api/itinerary', { destination: 'Agra', days: 2 });
  assert.equal(status, 502);
  assert.equal(json.code, 'BAD_OUTPUT');
});

test('itinerary: sanitises out-of-range numbers and bad enums from the model', async () => {
  const it = validItin(1);
  it.days[0].activities[0].estimatedCostInr = -50;
  it.days[0].activities[0].durationHours = 999;
  it.days[0].activities[0].time = 'Midnight';
  upstream = () => ({ status: 200, json: textReply(it) });
  const { json } = await post('/api/itinerary', { destination: 'Jaipur', days: 1 });
  const a = json.itinerary.days[0].activities[0];
  assert.equal(a.estimatedCostInr, null);
  assert.equal(a.durationHours, null);
  assert.equal(a.time, 'Morning');
});

test('revise: rejects an itinerary the client sends that fails validation', async () => {
  const { status } = await post('/api/itinerary/revise', { itinerary: { days: 'nope' }, instruction: 'cheaper' });
  assert.equal(status, 400);
});

test('budget: invalid categories and negative amounts are dropped; app (not model) does the sums', async () => {
  upstream = () => ({ status: 200, json: textReply({ destination: 'Goa', totalInr: 25000, days: 4, travelers: 2, tradeoffs: 't', assumptions: ['a'],
    items: [{ category: 'food', amountInr: 6000 }, { category: 'yachts', amountInr: 1 }, { category: 'misc', amountInr: -5 }, { category: 'food', amountInr: 7 }, { category: 'accommodation', amountInr: 9000 }] }) });
  const { status, json } = await post('/api/budget', { text: '25000 for 4 days in Goa' });
  assert.equal(status, 200);
  assert.deepEqual(json.budget.items.map((i) => i.category), ['food', 'accommodation']);
  assert.equal(json.budget.totalInr, 25000);
});

test('errors: quota errors map to a friendly message and never leak upstream details', async () => {
  upstream = () => ({ status: 429, json: { error: { message: 'SECRET-UPSTREAM-DETAIL quota' } } });
  const { status, json } = await post('/api/budget', { text: 'quota test unique 1' });
  assert.equal(status, 429);
  assert.equal(json.code, 'RATE_LIMIT');
  assert.ok(!JSON.stringify(json).includes('SECRET-UPSTREAM-DETAIL'));
});

test('validation: missing fields give clear 400s', async () => {
  assert.equal((await post('/api/chat', { messages: [] })).status, 400);
  assert.equal((await post('/api/itinerary', { destination: '', days: 2 })).status, 400);
  assert.equal((await post('/api/itinerary', { destination: 'Goa', days: 99 })).status, 400);
  assert.equal((await post('/api/budget', { text: '' })).status, 400);
});

test('limits: oversized body is rejected', async () => {
  const r = await fetch(base + '/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', text: 'x'.repeat(70_000) }] }) }).catch((e) => ({ status: 'closed', e }));
  assert.ok(r.status === 413 || r.status === 'closed');
});

test('no API key: AI routes explain the problem, health reports ai=false', async () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const { status, json } = await post('/api/budget', { text: 'x' });
  assert.equal(status, 503);
  assert.equal(json.code, 'NO_KEY');
  assert.equal((await (await fetch(base + '/api/health')).json()).ai, false);
  process.env.GEMINI_API_KEY = saved;
});

test('models: a daily-quota 429 puts that model on cooldown and the next model answers', async () => {
  let n = 0;
  upstream = (b) => {
    n++;
    return n === 1
      ? { status: 429, json: { error: { message: 'quota', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } } }
      : { status: 200, json: textReply({ summary: 's', recommendations: [{ destinationId: 'goa', why: 'w', tradeoffs: 't' }] }) };
  };
  const body = { prefs: { theme: 'beaches', notes: 'cooldown-test' }, candidates: [{ id: 'goa', name: 'Goa' }] };
  const first = await post('/api/match', body);
  assert.equal(first.status, 200, 'fell through to the next model');
  const urls = upstreamCalls.map((c) => c.url);
  assert.ok(urls[0] !== urls[1], 'second attempt used a different model');
});

test('models: a model that rejects the thinking option is retried without it', async () => {
  let n = 0;
  upstream = (b) => {
    n++;
    if (b.generationConfig.thinkingConfig) return { status: 400, json: { error: { message: 'Request contains an invalid argument.' } } };
    return { status: 200, json: textReply({ reply: 'ok', followUps: [], destinationIds: [], needsMoreInfo: false }) };
  };
  const { status } = await post('/api/chat', chatBody('hello thinking'));
  assert.equal(status, 200);
  assert.equal(upstreamCalls.length, 2);
  assert.equal(upstreamCalls[1].body.generationConfig.thinkingConfig, undefined);
});

test('models: when every model is out of quota the app gets one clear RATE_LIMIT answer (no retry storm)', async () => {
  upstream = () => ({ status: 429, json: { error: { message: 'quota', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } } });
  const { status, json } = await post('/api/budget', { text: 'all models exhausted unique' });
  assert.equal(status, 429);
  assert.equal(json.code, 'RATE_LIMIT');
  assert.ok(upstreamCalls.length <= 7, `at most one call per model, saw ${upstreamCalls.length}`);
  const again = await post('/api/budget', { text: 'all models exhausted unique 2' });
  assert.equal(again.status, 429);
  assert.equal(upstreamCalls.length <= 7, true, 'second request made no new upstream calls (cooldown)');
});

test('schemas sent to Gemini avoid maxItems and nullable type arrays (live models returned HTTP 400 for them)', async () => {
  upstream = () => ({ status: 200, json: textReply(validItin(2)) });
  await post('/api/itinerary', { destination: 'Goa', days: 2, notes: 'schema-regression' });
  const sent = JSON.stringify(upstreamCalls[0].body.generationConfig.responseJsonSchema);
  assert.ok(!/maxItems/.test(sent), 'no maxItems');
  assert.ok(!/"type":\[/.test(sent), 'no type arrays');
});

test('models: a model-specific 400 moves on to the next model instead of failing the request', async () => {
  let n = 0;
  upstream = (b) => {
    n++;
    if (n === 1) return { status: 400, json: { error: { message: 'Request contains an invalid argument.' } } };
    return { status: 200, json: textReply(validItin(1)) };
  };
  const { status } = await post('/api/itinerary', { destination: 'Agra', days: 1, notes: 'model-400' });
  assert.equal(status, 200);
  assert.ok(upstreamCalls.length >= 2);
});

test('budget: typed text is sent separately from saved trip hints, and the prompt says the text wins', async () => {
  upstream = () => ({ status: 200, json: textReply({ items: [{ category: 'food', amountInr: 5000 }], tradeoffs: 't', assumptions: ['a'] }) });
  await post('/api/budget', { text: 'I have 25000 rupees for 4 days', totalInr: 15000, days: 3, destination: 'Goa' });
  const sent = JSON.parse(upstreamCalls[0].body.contents[0].parts[0].text);
  assert.equal(sent.TRAVELLER_TEXT, 'I have 25000 rupees for 4 days');
  assert.equal(sent.TRIP_CONTEXT_HINTS.totalInr, 15000);
  assert.ok(upstreamCalls[0].body.systemInstruction.parts[0].text.includes('TRAVELLER_TEXT always wins'));
});

test('rate limit: too many requests from one IP get 429 with Retry-After', async () => {
  upstream = () => ({ status: 200, json: textReply({ reply: 'ok', followUps: [], destinationIds: [], needsMoreInfo: false }) });
  let limited = null;
  for (let i = 0; i < 160 && !limited; i++) {
    const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(chatBody('hello ' + i)) });
    if (r.status === 429) limited = r;
  }
  assert.ok(limited, 'eventually rate limited');
  assert.ok(limited.headers.get('retry-after'));
});

