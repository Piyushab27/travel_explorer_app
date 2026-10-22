/**
 * Itinerary types and the rule-based fallback.
 *  - The AI calls live in ai.ts.
 *  - buildOfflineItinerary is used only when the AI server is unreachable or has no API key.
 *    It is always labelled "Offline plan" in the UI and only works for destinations in the app.
 */
import { DESTINATIONS, Destination } from '../data/destinations';

export interface ItineraryRequest {
  destination: string;
  days: number;
  month: string;
  budget: string;
  style: string;
  interests: string[];
  preferHiddenGems: boolean;
  notes: string;
  travelers?: number | null;
  budgetInr?: number | null;
  startCity?: string;
}

export type ActivityCategory = 'sight' | 'food' | 'cafe' | 'shopping' | 'wellness' | 'transport' | 'rest' | 'activity';

export interface Activity {
  /** Local id used for list keys and edits. Never comes from the model. */
  id: string;
  time: 'Morning' | 'Afternoon' | 'Evening';
  text: string;
  mapQuery: string;
  category: ActivityCategory;
  durationHours: number | null;
  /** Rough estimate in rupees, or null when unknown. Never a quote. */
  estimatedCostInr: number | null;
}
export interface ItineraryDay {
  day: number;
  title: string;
  transportNote: string;
  activities: Activity[];
}
export interface Itinerary {
  title: string;
  summary: string;
  days: ItineraryDay[];
  budgetAssumptions: string;
  alternatives: string[];
  bookingReminders: string[];
  tips: string[];
  caveats: string;
}

/** "ai" came from the language model; "offline" came from the built-in rules. */
export type ItinerarySource = 'ai' | 'offline';

let counter = 0;
export const newId = () => `a${Date.now().toString(36)}${(counter++).toString(36)}`;

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
export function knownFacts(d: Destination): string {
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
      { id: newId(), time: 'Morning', text: `Visit ${attraction.name}.`, mapQuery: `${attraction.name}, ${d.name}`, category: 'sight', durationHours: null, estimatedCostInr: null },
    ];
    for (const time of ['Afternoon', 'Evening'] as const) {
      const exp = pool[e++ % pool.length];
      activities.push({ id: newId(), time, text: exp.text, mapQuery: `${exp.type} in ${d.name}`, category: 'activity', durationHours: null, estimatedCostInr: null });
    }
    days.push({ day: i, title: attraction.name, transportNote: '', activities });
  }
  return {
    title: `${req.days}-day ${d.name} plan`,
    summary: `A simple plan built from the app's own information about ${d.name}. Suggested stay: ${d.suggestedDays}.`,
    days,
    budgetAssumptions: '',
    alternatives: [],
    bookingReminders: [],
    tips: [d.planningTip, ...(d.tip ? [d.tip] : [])],
    caveats: `This is a basic offline plan, not AI-written. Best time to visit: ${d.bestTime}. Verify timings, permits, prices and weather before you travel.`,
  };
}
