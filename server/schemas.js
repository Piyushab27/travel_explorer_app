/**
 * JSON Schemas sent to Gemini (structured output) and the validators that check the reply again.
 * Gemini does not enforce every keyword (for example string length), so validators are the real gate:
 * nothing from the model reaches the app unless it passes here.
 */
const { AiError } = require('./gemini');

const TIMES = ['Morning', 'Afternoon', 'Evening'];
const ACTIVITY_CATEGORIES = ['sight', 'food', 'cafe', 'shopping', 'wellness', 'transport', 'rest', 'activity'];
const BUDGET_CATEGORIES = [
  'flights', 'accommodation', 'local_transport', 'intercity_transport', 'food',
  'attractions', 'shopping', 'wellness', 'visa', 'insurance', 'misc',
];

// ---------- Gemini schemas ----------
// Some Gemini models reject schemas that use maxItems or nullable type arrays (HTTP 400, found by testing
// against the live API). So the schemas sent to Gemini stay simple: unknown numbers are simply omitted.
// Limits (list lengths, number ranges, string lengths) are enforced by the validators below instead.
function simplify(node) {
  if (Array.isArray(node)) return node.map(simplify);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'maxItems') continue;
      out[k] = k === 'type' && Array.isArray(v) ? v.find((t) => t !== 'null') : simplify(v);
    }
    return out;
  }
  return node;
}

const str = { type: 'string' };
const strList = (max) => ({ type: 'array', items: str, maxItems: max });
const nullableNum = { type: ['number', 'null'] };

const activitySchema = {
  type: 'object',
  properties: {
    time: { type: 'string', enum: TIMES },
    text: str,
    mapQuery: str,
    category: { type: 'string', enum: ACTIVITY_CATEGORIES },
    durationHours: nullableNum,
    estimatedCostInr: nullableNum,
  },
  required: ['time', 'text', 'mapQuery', 'category'],
};

const itinerarySchema = {
  type: 'object',
  properties: {
    title: str,
    summary: str,
    days: {
      type: 'array',
      maxItems: 14,
      items: {
        type: 'object',
        properties: {
          day: { type: 'integer' },
          title: str,
          transportNote: str,
          activities: { type: 'array', items: activitySchema, maxItems: 6 },
        },
        required: ['day', 'title', 'activities'],
      },
    },
    budgetAssumptions: str,
    alternatives: strList(4),
    bookingReminders: strList(5),
    tips: strList(6),
    caveats: str,
  },
  required: ['title', 'summary', 'days', 'caveats'],
};

const chatSchema = {
  type: 'object',
  properties: {
    reply: str,
    followUps: strList(4),
    destinationIds: strList(3),
    needsMoreInfo: { type: 'boolean' },
  },
  required: ['reply', 'followUps', 'destinationIds', 'needsMoreInfo'],
};

const matchSchema = {
  type: 'object',
  properties: {
    summary: str,
    recommendations: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        properties: { destinationId: str, why: str, tradeoffs: str, tips: strList(3) },
        required: ['destinationId', 'why', 'tradeoffs'],
      },
    },
  },
  required: ['summary', 'recommendations'],
};

const budgetSchema = {
  type: 'object',
  properties: {
    destination: str,
    totalInr: nullableNum,
    days: { type: ['integer', 'null'] },
    travelers: { type: ['integer', 'null'] },
    items: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        properties: { category: { type: 'string', enum: BUDGET_CATEGORIES }, amountInr: { type: 'number' }, note: str },
        required: ['category', 'amountInr'],
      },
    },
    savings: { type: 'array', maxItems: 5, items: { type: 'object', properties: { tip: str, estimatedSavingInr: nullableNum }, required: ['tip'] } },
    missing: { type: 'array', maxItems: 8, items: { type: 'string', enum: BUDGET_CATEGORIES } },
    tradeoffs: str,
    assumptions: strList(6),
  },
  required: ['items', 'tradeoffs', 'assumptions'],
};

// ---------- validators (throw AiError BAD_OUTPUT) ----------
const bad = (msg) => new AiError('BAD_OUTPUT', msg, true);
const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const list = (v, maxItems, maxLen) => (Array.isArray(v) ? v.map((x) => clean(x, maxLen)).filter(Boolean).slice(0, maxItems) : []);
const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

function validateItinerary(raw, expectedDays) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.days)) throw bad('itinerary: days missing');
  const days = raw.days.slice(0, 14).map((d, i) => {
    const activities = (Array.isArray(d && d.activities) ? d.activities : []).slice(0, 6).map((a) => ({
      time: TIMES.includes(a && a.time) ? a.time : 'Morning',
      text: clean(a && a.text, 400),
      mapQuery: clean(a && a.mapQuery, 120),
      category: ACTIVITY_CATEGORIES.includes(a && a.category) ? a.category : 'activity',
      durationHours: num(a && a.durationHours, 0, 14),
      estimatedCostInr: num(a && a.estimatedCostInr, 0, 500000),
    })).filter((a) => a.text);
    return {
      day: i + 1, // always renumbered in order: never trust the model's numbering
      title: clean(d && d.title, 100) || `Day ${i + 1}`,
      transportNote: clean(d && d.transportNote, 300),
      activities,
    };
  });
  if (expectedDays && days.length !== expectedDays) throw bad(`itinerary: expected ${expectedDays} days, got ${days.length}`);
  if (days.length && days.every((d) => d.activities.length === 0)) throw bad('itinerary: no activities');
  return {
    title: clean(raw.title, 120) || 'Your trip',
    summary: clean(raw.summary, 600),
    days,
    budgetAssumptions: clean(raw.budgetAssumptions, 500),
    alternatives: list(raw.alternatives, 4, 250),
    bookingReminders: list(raw.bookingReminders, 5, 250),
    tips: list(raw.tips, 6, 300),
    caveats: clean(raw.caveats, 500) || 'Verify timings, permits, prices and weather before you travel.',
  };
}

function validateChat(raw, allowedIds) {
  if (!raw || typeof raw !== 'object') throw bad('chat: not an object');
  const reply = clean(raw.reply && String(raw.reply).replace(/\r/g, ''), 4000) ? String(raw.reply).replace(/\r/g, '').trim().slice(0, 4000) : '';
  if (!reply) throw bad('chat: empty reply');
  return {
    reply,
    followUps: list(raw.followUps, 4, 90),
    // The model may only reference real destination IDs from this app.
    destinationIds: (Array.isArray(raw.destinationIds) ? raw.destinationIds : []).filter((id) => allowedIds.includes(id)).slice(0, 3),
    needsMoreInfo: Boolean(raw.needsMoreInfo),
  };
}

function validateMatch(raw, candidateIds) {
  if (!raw || !Array.isArray(raw.recommendations)) throw bad('match: recommendations missing');
  const seen = new Set();
  const recommendations = [];
  for (const r of raw.recommendations) {
    const id = r && r.destinationId;
    if (!candidateIds.includes(id) || seen.has(id)) continue; // drop invented or duplicate IDs
    seen.add(id);
    recommendations.push({ destinationId: id, why: clean(r.why, 400), tradeoffs: clean(r.tradeoffs, 300), tips: list(r.tips, 3, 200) });
  }
  if (!recommendations.length) throw bad('match: no valid recommendations');
  return { summary: clean(raw.summary, 400), recommendations };
}

function validateBudget(raw) {
  if (!raw || !Array.isArray(raw.items)) throw bad('budget: items missing');
  const seen = new Set();
  const items = [];
  for (const it of raw.items) {
    const category = it && it.category;
    const amount = num(it && it.amountInr, 0, 10_000_000);
    if (!BUDGET_CATEGORIES.includes(category) || amount === null || seen.has(category)) continue;
    seen.add(category);
    items.push({ category, amountInr: Math.round(amount), note: clean(it.note, 160) });
  }
  if (!items.length) throw bad('budget: no valid items');
  return {
    destination: clean(raw.destination, 80),
    totalInr: num(raw.totalInr, 0, 100_000_000),
    days: Number.isInteger(raw.days) && raw.days >= 1 && raw.days <= 60 ? raw.days : null,
    travelers: Number.isInteger(raw.travelers) && raw.travelers >= 1 && raw.travelers <= 30 ? raw.travelers : null,
    items,
    savings: (Array.isArray(raw.savings) ? raw.savings : []).slice(0, 5).map((s) => ({ tip: clean(s && s.tip, 250), estimatedSavingInr: num(s && s.estimatedSavingInr, 0, 10_000_000) })).filter((s) => s.tip),
    missing: (Array.isArray(raw.missing) ? raw.missing : []).filter((c) => BUDGET_CATEGORIES.includes(c) && !seen.has(c)).slice(0, 8),
    tradeoffs: clean(raw.tradeoffs, 500),
    assumptions: list(raw.assumptions, 6, 250),
  };
}

module.exports = {
  TIMES, ACTIVITY_CATEGORIES, BUDGET_CATEGORIES,
  itinerarySchema: simplify(itinerarySchema), chatSchema: simplify(chatSchema), matchSchema: simplify(matchSchema), budgetSchema: simplify(budgetSchema),
  validateItinerary, validateChat, validateMatch, validateBudget,
};
