/**
 * Budget planner. The user describes a budget in plain language, the AI suggests an editable split,
 * and ALL arithmetic (totals, remaining money, shares) is done by app code (utils/budget.ts).
 *
 * Honesty rules shown in the UI:
 *  - AI amounts are labelled "Estimate"; anything the user edits becomes "Your amount".
 *  - No live prices, quotes or exchange rates are available, so none are shown. Amounts are in INR.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, type } from '../theme';
import { useTrip } from '../context/TripContext';
import { AiClientError, buildBudget } from '../services/ai';
import { findDestination } from '../services/itinerary';
import { BudgetSuggestion } from '../services/validate';
import { formatInr, parseAmount, summarizeBudget } from '../utils/budget';

const LABEL: Record<string, string> = {
  flights: 'Flights', accommodation: 'Accommodation', local_transport: 'Local transport', intercity_transport: 'Intercity transport',
  food: 'Food', attractions: 'Attractions', shopping: 'Shopping', wellness: 'Wellness', visa: 'Visa fees', insurance: 'Insurance', misc: 'Miscellaneous',
};
const EXAMPLES = [
  'I have ₹25,000 for a four-day trip to Goa. Help me split it across stay, food, transport and activities.',
  'We are 4 people with ₹60,000 for 5 days in Munnar.',
];

interface Line {
  category: string;
  amountText: string;
  basis: 'estimate' | 'user';
  note: string;
}

export default function BudgetScreen({ navigation }: any) {
  const { trip, plan } = useTrip();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState<BudgetSuggestion | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [totalText, setTotalText] = useState('');

  const build = async () => {
    if (loading) return;
    const clean = text.trim() || (trip.destination && trip.days ? `Plan a budget for ${trip.days} days in ${trip.destination}${trip.budgetInr ? ` with ${trip.budgetInr} rupees` : ''}.` : '');
    if (!clean) {
      setError('Describe your trip and budget first, for example: "₹25,000 for a four-day trip to Goa".');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const s = await buildBudget(clean, { destination: trip.destination, days: trip.days, travelers: trip.travelers, totalInr: trip.budgetInr });
      setSuggestion(s);
      setLines(s.items.map((i) => ({ category: i.category, amountText: String(i.amountInr), basis: 'estimate', note: i.note })));
      setTotalText(s.totalInr !== null ? String(s.totalInr) : trip.budgetInr ? String(trip.budgetInr) : '');
    } catch (e) {
      setError(e instanceof AiClientError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const setAmount = (idx: number, value: string) =>
    setLines((cur) => cur.map((l, i) => (i === idx ? { ...l, amountText: value.replace(/[^\d.,₹\s]/g, ''), basis: 'user' } : l)));

  // Deterministic maths: parse each line, ignore invalid ones, then add up.
  const parsed = lines.map((l) => ({ category: l.category, amountInr: parseAmount(l.amountText) ?? 0 }));
  const budget = parseAmount(totalText);
  const summary = summarizeBudget(parsed, budget);
  const dest = suggestion ? findDestination(suggestion.destination || trip.destination) : undefined;
  const knownEntry = dest?.ticket && dest.ticket.amount ? `${dest.name}: entry ${dest.ticket.label} per person (from this app's data; confirm on the official site).` : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.brand}>BUDGET PLANNER</Text>
        <Text style={styles.title}>Where will the money go?</Text>
        <Text style={styles.subtitle}>Describe your budget in your own words. The AI suggests a split; you can edit every number and the totals update instantly.</Text>

        <View style={styles.card}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={EXAMPLES[0]}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={600}
            style={styles.textarea}
            accessibilityLabel="Describe your budget"
          />
          <View style={styles.exampleRow}>
            {EXAMPLES.map((ex) => (
              <Pressable key={ex} onPress={() => setText(ex)} style={styles.example}>
                <Text style={styles.exampleText} numberOfLines={2}>{ex}</Text>
              </Pressable>
            ))}
          </View>
          {trip.destination !== '' && (
            <Text style={type.caption}>Using your trip: {trip.destination}{trip.days ? `, ${trip.days} days` : ''}{trip.travelers ? `, ${trip.travelers} travellers` : ''}.</Text>
          )}
          {error !== '' && <Text style={styles.error}>{error}</Text>}
          <Pressable style={[styles.buildBtn, loading && { opacity: 0.7 }]} onPress={build} disabled={loading} accessibilityRole="button">
            {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="calculator-outline" size={18} color="#fff" />}
            <Text style={styles.buildText}>{loading ? 'Building your budget…' : suggestion ? 'Rebuild budget' : 'Build my budget'}</Text>
          </Pressable>
        </View>

        {suggestion && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your budget</Text>
              <Text style={styles.label}>Total budget (₹)</Text>
              <TextInput value={totalText} onChangeText={(v) => setTotalText(v.replace(/[^\d.,₹\s]/g, ''))} keyboardType="numeric" placeholder="not given" placeholderTextColor={colors.muted} style={styles.amountInput} accessibilityLabel="Total budget" />

              <View style={styles.summaryRow}>
                <Summary label="Planned" value={formatInr(summary.total)} />
                {summary.remaining !== null && <Summary label={summary.overBudget ? 'Over by' : 'Left'} value={formatInr(Math.abs(summary.remaining))} tone={summary.overBudget ? 'bad' : 'good'} />}
              </View>
              {summary.overBudget && <Text style={styles.warnText}>You are over budget. Lower a line below or see the savings ideas.</Text>}
              {budget === null && <Text style={type.caption}>Add a total budget to see how much is left.</Text>}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Breakdown</Text>
              <Text style={type.caption}>Tap an amount to change it. "Estimate" amounts come from the AI and are not live prices.</Text>
              {lines.map((l, idx) => (
                <View key={l.category} style={styles.lineRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineName}>{LABEL[l.category] ?? l.category}</Text>
                    <View style={styles.basisRow}>
                      <View style={[styles.basis, l.basis === 'user' ? styles.basisUser : styles.basisEstimate]}>
                        <Text style={styles.basisText}>{l.basis === 'user' ? 'Your amount' : 'Estimate'}</Text>
                      </View>
                      <Text style={type.caption}>{summary.shares[l.category] ?? 0}%</Text>
                    </View>
                    {l.category === 'attractions' && knownEntry !== '' && <Text style={type.caption}>Known price: {knownEntry}</Text>}
                    {l.note !== '' && <Text style={type.caption}>{l.note}</Text>}
                  </View>
                  <TextInput value={l.amountText} onChangeText={(v) => setAmount(idx, v)} keyboardType="numeric" style={styles.amountInput2} accessibilityLabel={`${LABEL[l.category] ?? l.category} amount`} />
                  <Pressable onPress={() => setLines((cur) => cur.filter((_, i) => i !== idx))} hitSlop={8} accessibilityLabel={`Remove ${LABEL[l.category] ?? l.category}`}>
                    <Ionicons name="close-circle-outline" size={22} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
              {(() => {
                const absent = suggestion.missing.filter((m) => !lines.some((l) => l.category === m));
                return absent.length > 0 ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.label}>You may also need to budget for</Text>
                    <View style={styles.chipWrap}>
                      {absent.map((m) => (
                        <Pressable key={m} style={styles.addChip} onPress={() => setLines((cur) => [...cur, { category: m, amountText: '0', basis: 'user', note: '' }])}>
                          <Ionicons name="add" size={14} color={colors.primary} />
                          <Text style={styles.addChipText}>{LABEL[m] ?? m}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null;
              })()}
            </View>

            {suggestion.savings.length > 0 && (
              <View style={styles.tipsBox}>
                <Text style={styles.tipsTitle}>Ways to save</Text>
                {suggestion.savings.map((s) => (
                  <Text key={s.tip} style={type.body}>• {s.tip}{s.estimatedSavingInr ? ` (could save about ${formatInr(s.estimatedSavingInr)}, an estimate)` : ''}</Text>
                ))}
              </View>
            )}
            {suggestion.tradeoffs !== '' && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Trade-offs</Text>
                <Text style={type.body}>{suggestion.tradeoffs}</Text>
              </View>
            )}
            {suggestion.assumptions.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Assumptions</Text>
                {suggestion.assumptions.map((a) => (
                  <Text key={a} style={type.body}>• {a}</Text>
                ))}
              </View>
            )}
            <Text style={styles.disclaimer}>
              All amounts are in Indian rupees. The suggested numbers are AI estimates, not live prices or quotes: flight fares, hotel rates, fees and availability are not connected. No exchange rates are shown because live rates are not available. Check real prices before booking.
            </Text>
            {plan && (
              <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('Tabs', { screen: 'Plan' })}>
                <Ionicons name="map-outline" size={16} color={colors.primary} />
                <Text style={styles.linkText}>Back to my itinerary</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, tone === 'bad' && { color: colors.heart }, tone === 'good' && { color: colors.success }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60, gap: 14 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  brand: { color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 12 },
  title: type.title,
  subtitle: { ...type.body, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 8, ...shadow },
  cardTitle: { ...type.section },
  label: { fontWeight: '700', color: colors.text, fontSize: 14, marginTop: 6 },
  textarea: { minHeight: 92, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 15, textAlignVertical: 'top', outlineStyle: 'none' } as any,
  exampleRow: { gap: 8 },
  example: { backgroundColor: colors.accentSoft, borderRadius: 12, padding: 10 },
  exampleText: { color: colors.accent, fontWeight: '600', fontSize: 12.5, lineHeight: 18 },
  error: { color: colors.warn, fontWeight: '600', lineHeight: 20 },
  buildBtn: { marginTop: 4, backgroundColor: colors.accent, borderRadius: 14, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buildText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  amountInput: { height: 46, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 16, fontWeight: '700', outlineStyle: 'none' } as any,
  summaryRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  summaryBox: { flex: 1, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12 },
  summaryLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  summaryValue: { fontSize: 22, fontWeight: '900', color: colors.primaryDark, marginTop: 2 },
  warnText: { color: colors.heart, fontWeight: '600', fontSize: 13 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  lineName: { fontWeight: '700', color: colors.text, fontSize: 15 },
  basisRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  basis: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  basisEstimate: { backgroundColor: colors.warnSoft },
  basisUser: { backgroundColor: colors.successSoft },
  basisText: { fontSize: 11, fontWeight: '800', color: colors.text },
  amountInput2: { width: 92, height: 42, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, color: colors.text, fontWeight: '700', textAlign: 'right', outlineStyle: 'none' } as any,
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  addChipText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  tipsBox: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 16, gap: 6 },
  tipsTitle: { ...type.section, color: colors.primaryDark },
  disclaimer: { ...type.caption, lineHeight: 18 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  linkText: { color: colors.primary, fontWeight: '700' },
});
