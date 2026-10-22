/** Unit tests for the deterministic budget maths (Node runs the TypeScript file directly). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, summarizeBudget, itineraryTotals, formatInr } from '../src/utils/budget.ts';

test('summarizeBudget adds line items exactly and reports remaining money', () => {
  const s = summarizeBudget([{ category: 'food', amountInr: 6000 }, { category: 'stay', amountInr: 9000 }, { category: 'misc', amountInr: 1500 }], 25000);
  assert.equal(s.total, 16500);
  assert.equal(s.remaining, 8500);
  assert.equal(s.overBudget, false);
});

test('summarizeBudget flags overspending and handles missing budget', () => {
  assert.equal(summarizeBudget([{ category: 'a', amountInr: 30000 }], 25000).overBudget, true);
  assert.equal(summarizeBudget([{ category: 'a', amountInr: 30000 }], 25000).remaining, -5000);
  assert.equal(summarizeBudget([{ category: 'a', amountInr: 10 }], null).remaining, null);
});

test('summarizeBudget ignores negative, NaN and infinite amounts instead of corrupting the total', () => {
  const s = summarizeBudget([{ category: 'a', amountInr: -500 }, { category: 'b', amountInr: NaN }, { category: 'c', amountInr: Infinity }, { category: 'd', amountInr: 1000 }], null);
  assert.equal(s.total, 1000);
});

test('summarizeBudget shares are percentages of the total', () => {
  const s = summarizeBudget([{ category: 'food', amountInr: 1000 }, { category: 'stay', amountInr: 3000 }], null);
  assert.equal(s.shares.food, 25);
  assert.equal(s.shares.stay, 75);
});

test('parseAmount accepts rupee formats and rejects junk', () => {
  assert.equal(parseAmount('₹12,500'), 12500);
  assert.equal(parseAmount(' 800 '), 800);
  assert.equal(parseAmount('1999.6'), 2000);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('-5'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('1e9'), null);
});

test('itineraryTotals sums per day and trip, reporting unknown costs', () => {
  const t = itineraryTotals([
    { activities: [{ estimatedCostInr: 500 }, { estimatedCostInr: null }, { estimatedCostInr: 250 }] },
    { activities: [{ estimatedCostInr: 1000 }] },
  ]);
  assert.deepEqual(t.perDay, [750, 1000]);
  assert.equal(t.total, 1750);
  assert.equal(t.unknownCount, 1);
});

test('itineraryTotals updates when an activity is removed (derived totals follow edits)', () => {
  const days = [{ activities: [{ estimatedCostInr: 500 }, { estimatedCostInr: 300 }] }];
  assert.equal(itineraryTotals(days).total, 800);
  days[0].activities.splice(0, 1);
  assert.equal(itineraryTotals(days).total, 300);
});

test('formatInr uses Indian digit grouping', () => {
  assert.equal(formatInr(999), '₹999');
  assert.equal(formatInr(25000), '₹25,000');
  assert.equal(formatInr(1234567), '₹12,34,567');
  assert.equal(formatInr(-1500), '-₹1,500');
});
