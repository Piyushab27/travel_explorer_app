/**
 * Regression test for a bug found during testing: a lighter Gemini model returned a whole answer on one
 * line starting with "##", which was rendered as one giant heading. normalise() must split it.
 * (RichText.tsx imports react-native, so the pure function is extracted from the source.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/components/RichText.tsx', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('export function normalise'), src.indexOf('export default function RichText'));
const normalise = new Function(body.replace('export function normalise(text: string): string', 'function normalise(text)') + '; return normalise;')();

const oneLine =
  '## Three-Day Goa Escape. For a couple with a 15,000 INR budget (estimate), focus on North Goa for cafe-hopping and beach access. Day 1: Explore the beaches of North Goa and enjoy sunset at a beach shack. Day 2: Visit local markets and sample Goan fish curry. Day 3: Relax at a quieter beach in the north.';

test('one-line answers are split into heading, intro and one line per day', () => {
  const lines = normalise(oneLine).split('\n');
  assert.equal(lines[0], '## Three-Day Goa Escape.');
  assert.ok(lines.some((l) => l.startsWith('Day 1:')));
  assert.ok(lines.some((l) => l.startsWith('Day 2:')));
  assert.ok(lines.some((l) => l.startsWith('Day 3:')));
  assert.ok(lines.length >= 5);
});

test('answers that already have line breaks are left alone', () => {
  const ok = '## Title\n- one\n- two\n\nSome text. Day 1: should stay on this line because there are newlines.';
  assert.equal(normalise(ok), ok);
});

test('short single-line answers are left alone', () => {
  assert.equal(normalise('Yes, that works.'), 'Yes, that works.');
});
