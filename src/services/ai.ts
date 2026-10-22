/**
 * Client for the Roam India AI server. No API key ever lives in the app: every call goes to the
 * server (see server/index.js), which talks to Gemini.
 *
 * - Identical in-flight requests are shared, so double taps cannot send duplicates.
 * - Every failure becomes an AiClientError with a stable code and a friendly message.
 * - Every payload is validated by validate.ts before the UI sees it.
 */
import { Itinerary, ItineraryRequest, findDestination, knownFacts } from './itinerary';
import { BudgetSuggestion, ChatReply, MatchExplanation, parseBudget, parseChat, parseItinerary, parseMatch } from './validate';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export type AiErrorCode = 'NETWORK' | 'TIMEOUT' | 'RATE_LIMIT' | 'BUSY' | 'NO_KEY' | 'BAD_REQUEST' | 'BAD_OUTPUT' | 'BLOCKED' | 'UPSTREAM' | 'SERVER';

export class AiClientError extends Error {
  code: AiErrorCode;
  retryAfterSec?: number;
  constructor(code: AiErrorCode, message: string, retryAfterSec?: number) {
    super(message);
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
  /** Whether a "Try again" button makes sense. */
  get retryable() {
    return ['NETWORK', 'TIMEOUT', 'RATE_LIMIT', 'BUSY', 'BAD_OUTPUT', 'UPSTREAM'].includes(this.code);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const inflight = new Map<string, Promise<any>>();

async function post(path: string, body: unknown, timeoutMs = 100_000): Promise<any> {
  const payload = JSON.stringify(body);
  const key = path + payload;
  const existing = inflight.get(key);
  if (existing) return existing;
  const run = (async () => {
    let res: Response;
    try {
      res = await fetchWithTimeout(`${API_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }, timeoutMs);
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new AiClientError('TIMEOUT', 'The AI took too long to answer. Please try again.');
      throw new AiClientError('NETWORK', "Can't reach the AI server. Check that it is running and that you are online.");
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new AiClientError((json.code as AiErrorCode) || 'UPSTREAM', json.error || 'The AI service returned an error.', json.retryAfterSec);
    }
    return json;
  })();
  inflight.set(key, run);
  try {
    return await run;
  } finally {
    inflight.delete(key);
  }
}

const invalid = () => new AiClientError('BAD_OUTPUT', 'The AI sent an unusable answer. Please try again.');

/** Is the AI server reachable and configured with a key? */
export async function checkAi(): Promise<boolean> {
  try {
    const r = await fetchWithTimeout(`${API_URL}/api/health`, {}, 4000);
    if (!r.ok) return false;
    return Boolean((await r.json()).ai);
  } catch {
    return false;
  }
}

// ---------- concierge chat ----------
export interface TripContext {
  destination?: string;
  destinationId?: string;
  days?: number | null;
  budgetInr?: number | null;
  travelers?: number | null;
  style?: string;
  budgetLevel?: string;
  interests?: string[];
  month?: string;
  startCity?: string;
  facts?: string;
  itinerarySummary?: string;
}

export async function chat(
  messages: { role: 'user' | 'assistant'; text: string }[],
  context: TripContext,
  allowedDestinations: { id: string; name: string }[],
  forceResearch = false,
): Promise<ChatReply> {
  const dest = context.destination ? findDestination(context.destination) : undefined;
  const ctx = { ...context, destinationId: dest?.id ?? context.destinationId, facts: context.facts ?? (dest ? knownFacts(dest) : undefined) };
  const parsed = parseChat(await post('/api/chat', { messages, context: ctx, allowedDestinations, forceResearch }, 60_000));
  if (!parsed) throw invalid();
  return parsed;
}

// ---------- trip match explanations ----------
export async function explainMatches(prefs: unknown, candidates: unknown[], allowedIds: string[]) {
  const parsed = parseMatch(await post('/api/match', { prefs, candidates }, 60_000), allowedIds);
  if (!parsed) throw invalid();
  return parsed as { summary: string; recommendations: MatchExplanation[] };
}

// ---------- itineraries ----------
export async function generateItinerary(req: ItineraryRequest): Promise<Itinerary> {
  const known = findDestination(req.destination);
  const json = await post('/api/itinerary', { ...req, knownFacts: known ? knownFacts(known) : '' }, 100_000);
  const it = parseItinerary(json.itinerary);
  if (!it || (it.days.length !== req.days && it.days.length !== 0)) throw invalid();
  return it;
}

export async function reviseItinerary(
  itinerary: Itinerary,
  instruction: string,
  opts: { dayIndex?: number; activityIndex?: number; facts?: string } = {},
): Promise<Itinerary> {
  const json = await post('/api/itinerary/revise', { itinerary, instruction, ...opts }, 100_000);
  const it = parseItinerary(json.itinerary);
  if (!it || it.days.length !== itinerary.days.length) throw invalid();
  return it;
}

export async function explainItinerary(itinerary: Itinerary): Promise<string> {
  const json = await post('/api/itinerary/explain', { itinerary }, 60_000);
  if (typeof json.explanation !== 'string' || !json.explanation.trim()) throw invalid();
  return json.explanation;
}

// ---------- budget ----------
export async function buildBudget(text: string, extra: { destination?: string; days?: number | null; travelers?: number | null; totalInr?: number | null } = {}): Promise<BudgetSuggestion> {
  const parsed = parseBudget((await post('/api/budget', { text, ...extra }, 60_000)).budget);
  if (!parsed) throw invalid();
  return parsed;
}
