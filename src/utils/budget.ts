/**
 * Deterministic budget and itinerary-cost arithmetic.
 * The AI suggests estimates; ALL totals are computed here. This file has no imports so it can be
 * unit-tested directly (see tests/budget.test.mjs).
 */

export interface BudgetLine {
  category: string;
  amountInr: number;
}

export interface BudgetSummary {
  /** Sum of all line items, in whole rupees. */
  total: number;
  /** Trip budget minus total (negative when over budget); null if no budget was given. */
  remaining: number | null;
  overBudget: boolean;
  /** Share of the total for each category, 0 to 100, rounded to a whole percent. */
  shares: Record<string, number>;
}

/** Parses user-typed money like "₹12,500" or "12500.4". Returns null for anything invalid or negative. */
export function parseAmount(input: string): number | null {
  const cleaned = String(input).replace(/[₹,\s]/g, '');
  if (cleaned === '' || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Math.round(Number(cleaned));
  return Number.isFinite(n) && n <= 100_000_000 ? n : null;
}

export function summarizeBudget(lines: BudgetLine[], budgetInr: number | null): BudgetSummary {
  const total = lines.reduce((sum, l) => sum + (Number.isFinite(l.amountInr) && l.amountInr > 0 ? Math.round(l.amountInr) : 0), 0);
  const shares: Record<string, number> = {};
  for (const l of lines) {
    const amount = Number.isFinite(l.amountInr) && l.amountInr > 0 ? Math.round(l.amountInr) : 0;
    shares[l.category] = total > 0 ? Math.round((amount / total) * 100) : 0;
  }
  const remaining = budgetInr === null ? null : budgetInr - total;
  return { total, remaining, overBudget: remaining !== null && remaining < 0, shares };
}

export interface CostedActivity {
  estimatedCostInr: number | null;
}
export interface CostedDay {
  activities: CostedActivity[];
}

export interface ItineraryTotals {
  perDay: number[];
  total: number;
  /** Number of activities that have no estimate, so the total is a lower bound. */
  unknownCount: number;
}

/** Adds up estimated activity costs per day and for the trip. Unknown costs count as 0 but are reported. */
export function itineraryTotals(days: CostedDay[]): ItineraryTotals {
  let unknownCount = 0;
  const perDay = days.map((d) =>
    d.activities.reduce((sum, a) => {
      if (a.estimatedCostInr === null || !Number.isFinite(a.estimatedCostInr)) {
        unknownCount += 1;
        return sum;
      }
      return sum + Math.max(0, Math.round(a.estimatedCostInr));
    }, 0),
  );
  return { perDay, total: perDay.reduce((a, b) => a + b, 0), unknownCount };
}

/** Formats rupees with Indian digit grouping, e.g. 1234567 -> "₹12,34,567". */
export function formatInr(amount: number): string {
  const n = Math.round(amount);
  const sign = n < 0 ? '-' : '';
  const digits = String(Math.abs(n));
  if (digits.length <= 3) return `${sign}₹${digits}`;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}₹${rest},${last3}`;
}
