/**
 * Client-side validation of everything that comes back from the AI server.
 * The server already validates, but the app never trusts a payload blindly: each parser returns
 * a safe, typed value or null, so a malformed reply can never crash a screen.
 */
import { DESTINATIONS } from '../data/destinations';
import { Activity, ActivityCategory, Itinerary, newId } from './itinerary';

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strs = (v: unknown, n: number, max = 300) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
const numOrNull = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

const TIMES = ['Morning', 'Afternoon', 'Evening'] as const;
const CATS: ActivityCategory[] = ['sight', 'food', 'cafe', 'shopping', 'wellness', 'transport', 'rest', 'activity'];

/** Only http(s) links are ever rendered or opened. */
export function safeUrl(value: unknown): string | null {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function parseActivity(a: any): Activity | null {
  if (!isObj(a) || !str(a.text)) return null;
  return {
    id: typeof a.id === 'string' && a.id ? a.id : newId(),
    time: (TIMES as readonly string[]).includes(a.time) ? a.time : 'Morning',
    text: str(a.text, 400),
    mapQuery: str(a.mapQuery, 120),
    category: CATS.includes(a.category) ? a.category : 'activity',
    durationHours: numOrNull(a.durationHours, 0, 14),
    estimatedCostInr: numOrNull(a.estimatedCostInr, 0, 500000),
  };
}

export function parseItinerary(raw: any): Itinerary | null {
  if (!isObj(raw) || !Array.isArray(raw.days)) return null;
  const days = raw.days.slice(0, 14).map((d: any, i: number) => ({
    day: i + 1,
    title: str(d?.title, 100) || `Day ${i + 1}`,
    transportNote: str(d?.transportNote, 300),
    activities: (Array.isArray(d?.activities) ? d.activities : []).slice(0, 8).map(parseActivity).filter(Boolean) as Activity[],
  }));
  return {
    title: str(raw.title, 120) || 'Your trip',
    summary: str(raw.summary, 600),
    days,
    budgetAssumptions: str(raw.budgetAssumptions, 500),
    alternatives: strs(raw.alternatives, 4, 250),
    bookingReminders: strs(raw.bookingReminders, 5, 250),
    tips: strs(raw.tips, 6, 300),
    caveats: str(raw.caveats, 500) || 'Verify timings, permits, prices and weather before you travel.',
  };
}

export interface Source {
  title: string;
  url: string;
}
export interface ChatReply {
  reply: string;
  followUps: string[];
  /** Real destination IDs only. */
  destinationIds: string[];
  needsMoreInfo: boolean;
  research: { used: boolean; unavailable: boolean; sources: Source[] };
}

export function parseChat(raw: any): ChatReply | null {
  if (!isObj(raw) || !str(raw.reply, 4000)) return null;
  const known = new Set(DESTINATIONS.map((d) => d.id));
  const sources: Source[] = [];
  for (const s of Array.isArray(raw.research?.sources) ? raw.research.sources.slice(0, 8) : []) {
    const url = safeUrl(s?.url);
    if (url) sources.push({ title: str(s?.title, 120) || url, url });
  }
  return {
    reply: String(raw.reply).trim().slice(0, 4000),
    followUps: strs(raw.followUps, 4, 90),
    destinationIds: (Array.isArray(raw.destinationIds) ? raw.destinationIds : []).filter((id: any) => known.has(id)).slice(0, 3),
    needsMoreInfo: Boolean(raw.needsMoreInfo),
    research: { used: Boolean(raw.research?.used), unavailable: Boolean(raw.research?.unavailable), sources },
  };
}

export interface MatchExplanation {
  destinationId: string;
  why: string;
  tradeoffs: string;
  tips: string[];
}
export function parseMatch(raw: any, allowedIds: string[]): { summary: string; recommendations: MatchExplanation[] } | null {
  if (!isObj(raw) || !Array.isArray(raw.recommendations)) return null;
  const recs: MatchExplanation[] = [];
  for (const r of raw.recommendations) {
    if (isObj(r) && allowedIds.includes(r.destinationId) && str(r.why) && !recs.some((x) => x.destinationId === r.destinationId)) {
      recs.push({ destinationId: r.destinationId, why: str(r.why, 400), tradeoffs: str(r.tradeoffs, 300), tips: strs(r.tips, 3, 200) });
    }
  }
  return recs.length ? { summary: str(raw.summary, 400), recommendations: recs } : null;
}

export interface BudgetSuggestion {
  destination: string;
  totalInr: number | null;
  days: number | null;
  travelers: number | null;
  items: { category: string; amountInr: number; note: string }[];
  savings: { tip: string; estimatedSavingInr: number | null }[];
  missing: string[];
  tradeoffs: string;
  assumptions: string[];
}
export function parseBudget(raw: any): BudgetSuggestion | null {
  if (!isObj(raw) || !Array.isArray(raw.items)) return null;
  const items = raw.items
    .filter((i: any) => isObj(i) && str(i.category, 40) && typeof i.amountInr === 'number' && Number.isFinite(i.amountInr) && i.amountInr >= 0)
    .slice(0, 12)
    .map((i: any) => ({ category: str(i.category, 40), amountInr: Math.round(i.amountInr), note: str(i.note, 160) }));
  if (!items.length) return null;
  return {
    destination: str(raw.destination, 80),
    totalInr: numOrNull(raw.totalInr, 0, 100_000_000),
    days: Number.isInteger(raw.days) ? raw.days : null,
    travelers: Number.isInteger(raw.travelers) ? raw.travelers : null,
    items,
    savings: (Array.isArray(raw.savings) ? raw.savings : []).slice(0, 5).map((s: any) => ({ tip: str(s?.tip, 250), estimatedSavingInr: numOrNull(s?.estimatedSavingInr, 0, 10_000_000) })).filter((s: any) => s.tip),
    missing: strs(raw.missing, 8, 40),
    tradeoffs: str(raw.tradeoffs, 500),
    assumptions: strs(raw.assumptions, 6, 250),
  };
}
