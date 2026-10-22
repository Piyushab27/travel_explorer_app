/**
 * Itinerary service.
 *  - generateAiItinerary: asks the Roam India server, which calls a real Gemini model.
 *  - buildOfflineItinerary: a simple rule-based plan from the app's own data, used only when
 *    the AI server is unreachable or has no API key. It is always labelled "Offline plan".
 */
import { DESTINATIONS, Destination } from '../data/destinations';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export interface ItineraryRequest {
  destination: string;
  days: number;
  month: string;
  budget: string;
  style: string;
  interests: string[];
  preferHiddenGems: boolean;
  notes: string;
}

export interface Activity {
  time: 'Morning' | 'Afternoon' | 'Evening';
  text: string;
  mapQuery: string;
}
export interface ItineraryDay {
  day: number;
  title: string;
  activities: Activity[];
}
export interface Itinerary {
  title: string;
  summary: string;
  days: ItineraryDay[];
  tips: string[];
  caveats: string;
}

/** "ai" came from the language model; "offline" came from the built-in rules. */
export type ItinerarySource = 'ai' | 'offline';

/** fetch with a timeout. Uses AbortController because AbortSignal.timeout is missing on some React Native runtimes. */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Finds a destination in the app's data by (partial, case-insensitive) name. */
export function findDestination(name: string): Destination | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  return (
    DESTINATIONS.find((d) => d.name.toLowerCase() === q) ??
    DESTINATIONS.find((d) => d.name.toLowerCase().includes(q) || q.includes(d.name.toLowerCase().split(' (')[0]))
  );
}

/** Facts from the app's own data, sent to the model so it stays grounded. */
function knownFacts(d: Destination): string {
  return [
    `Best time: ${d.bestTime}.`,
    `Suggested stay: ${d.suggestedDays}.`,
    `Popular attractions: ${d.attractions.map((a) => a.name).join(', ')}.`,
    `Experiences: ${d.experiences.map((e) => `${e.type}: ${e.text}`).join(' ')}`,
    d.ticket ? `Entry: ${d.ticket.label}. ${d.ticket.note}` : '',
    d.tip ? `Local tip: ${d.tip}` : '',
    `Tip: ${d.planningTip}`,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Is the AI server reachable and configured with a key? */
export async function checkAi(): Promise<boolean> {
  try {
    const r = await fetchWithTimeout(`${API_URL}/api/health`, {}, 4000);
    if (!r.ok) return false;
    const j = await r.json();
    return Boolean(j.ai);
  } catch {
    return false;
  }
}

export async function generateAiItinerary(req: ItineraryRequest): Promise<Itinerary> {
  const known = findDestination(req.destination);
  const r = await fetchWithTimeout(
    `${API_URL}/api/itinerary`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req, knownFacts: known ? knownFacts(known) : '' }),
    },
    100000,
  );
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'The AI planner is unavailable.');
  return j.itinerary as Itinerary;
}

/** Rule-based fallback. Only works for destinations in the app's data. */
export function buildOfflineItinerary(req: ItineraryRequest): Itinerary | null {
  const d = findDestination(req.destination);
  if (!d) return null;

  // Preferred interests first, then the rest, so a long trip never repeats an idea until it must.
  const preferred = d.experiences.filter((e) => req.interests.includes(e.type));
  const pool = [...preferred, ...d.experiences.filter((e) => !preferred.includes(e))];

  const days: ItineraryDay[] = [];
  let e = 0;
  for (let i = 1; i <= req.days; i++) {
    const attraction = d.attractions[(i - 1) % d.attractions.length];
    const activities: Activity[] = [
      { time: 'Morning', text: `Visit ${attraction.name}.`, mapQuery: `${attraction.name}, ${d.name}` },
    ];
    for (const time of ['Afternoon', 'Evening'] as const) {
      const exp = pool[e++ % pool.length];
      activities.push({ time, text: exp.text, mapQuery: `${exp.type} in ${d.name}` });
    }
    days.push({ day: i, title: attraction.name, activities });
  }
  return {
    title: `${req.days}-day ${d.name} plan`,
    summary: `A simple plan built from the app's own information about ${d.name}. Suggested stay: ${d.suggestedDays}.`,
    days,
    tips: [d.planningTip, ...(d.tip ? [d.tip] : [])],
    caveats: `This is a basic offline plan, not AI-written. Best time to visit: ${d.bestTime}. Verify timings, permits, prices and weather before you travel.`,
  };
}
