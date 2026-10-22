/**
 * Smart Trip Match: a simple, deterministic scoring engine (no AI model, no network).
 *
 * Each destination earns points for every preference it satisfies:
 *   preferred experience  +4   (the most important choice)
 *   budget                +2
 *   trip duration         +2 exact, +1 if one band away
 *   travel style          +2
 *   each chosen interest  +1
 * Only destinations that fit the chosen experience are listed, sorted by score, and each carries
 * the human-readable reasons it matched.
 */
import { Destination, DESTINATIONS } from '../data/destinations';
import { Budget, Duration, Interest, Theme, TravelStyle } from '../data/guide';

export interface Preferences {
  theme: Theme | null;
  budget: Budget | null;
  duration: Duration | null;
  style: TravelStyle | null;
  interests: Interest[];
}

export const EMPTY_PREFERENCES: Preferences = {
  theme: null,
  budget: null,
  duration: null,
  style: null,
  interests: [],
};

export interface Match {
  destination: Destination;
  score: number;
  reasons: string[];
}

const DURATION_ORDER: Duration[] = ['short', 'week', 'extended'];
const THEME_LABEL: Record<Theme, string> = {
  beaches: 'beaches',
  mountains: 'mountains',
  heritage: 'heritage',
  adventure: 'adventure',
  wildlife: 'wildlife',
};
export const INTEREST_LABEL: Record<Interest, string> = {
  food: 'food',
  cafes: 'cafés',
  markets: 'markets',
  nature: 'nature',
  wellness: 'wellness',
  shopping: 'shopping',
  adventure: 'adventure',
};

/** A match needs at least a preferred experience; everything else is optional. */
export function isValid(p: Preferences): boolean {
  return p.theme !== null;
}

export function matchDestinations(p: Preferences, limit = 3): Match[] {
  if (!isValid(p)) return [];

  const matches = DESTINATIONS.map((d): Match => {
    let score = 0;
    const reasons: string[] = [];

    if (p.theme && d.theme === p.theme) {
      score += 4;
      reasons.push(`It is a top pick for ${THEME_LABEL[p.theme]}.`);
    }
    if (p.budget && d.budgets.includes(p.budget)) {
      score += 2;
      reasons.push(`It suits a ${p.budget === 'budget' ? 'budget-friendly' : p.budget} trip.`);
    }
    if (p.duration) {
      const gap = Math.abs(DURATION_ORDER.indexOf(d.duration) - DURATION_ORDER.indexOf(p.duration));
      if (gap === 0) {
        score += 2;
        reasons.push(`${d.suggestedDays} is the ideal length for it.`);
      } else if (gap === 1) {
        score += 1;
      }
    }
    if (p.style && d.styles.includes(p.style)) {
      score += 2;
      reasons.push(`It works well for ${p.style === 'solo' ? 'solo travellers' : p.style === 'family' ? 'families' : p.style === 'couple' ? 'couples' : 'friends'}.`);
    }
    const matchedInterests = p.interests.filter((i) => d.experiences.some((e) => e.type === i));
    if (matchedInterests.length) {
      score += matchedInterests.length;
      reasons.push(`It offers ${matchedInterests.map((i) => INTEREST_LABEL[i]).join(', ')}.`);
    }
    return { destination: d, score, reasons };
  });

  // Only suggest places that fit the chosen experience; then highest score first.
  // Ties keep the original order so results are stable.
  return matches
    .filter((m) => m.destination.theme === p.theme)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
