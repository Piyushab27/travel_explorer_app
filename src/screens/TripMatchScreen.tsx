/**
 * Smart Trip Match. Two steps:
 *  1. The local rule-based engine (utils/matcher.ts) picks plausible destinations from the app's own data.
 *  2. Gemini explains why each fits THIS traveller and names a trade-off. Its answer is mapped back to the
 *     app's real destination IDs; anything invented is discarded.
 * If the AI is unavailable the rule-based results are shown on their own, clearly labelled.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, type } from '../theme';
import { Budget, Duration, Interest, Theme, TravelStyle } from '../data/guide';
import { EMPTY_PREFERENCES, INTEREST_LABEL, Match, Preferences, isValid, matchDestinations } from '../utils/matcher';
import SafeImage from '../components/SafeImage';
import { Chip, Group } from '../components/Chips';
import { AiClientError, explainMatches } from '../services/ai';
import { MatchExplanation } from '../services/validate';
import { useTrip } from '../context/TripContext';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PREFS_KEY = 'matchPrefs:v1';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'beaches', label: 'Beaches' },
  { value: 'mountains', label: 'Mountains' },
  { value: 'heritage', label: 'Heritage' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'wildlife', label: 'Wildlife' },
];
const BUDGETS: { value: Budget; label: string }[] = [
  { value: 'budget', label: 'Budget-friendly' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'premium', label: 'Premium' },
];
const DURATIONS: { value: Duration; label: string }[] = [
  { value: 'short', label: 'Short trip' },
  { value: 'week', label: '4–7 days' },
  { value: 'extended', label: 'Extended' },
];
const STYLES: { value: TravelStyle; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: 'family', label: 'Family' },
  { value: 'couple', label: 'Couple' },
  { value: 'friends', label: 'Friends' },
];
const INTERESTS = Object.entries(INTEREST_LABEL).map(([value, label]) => ({
  value: value as Interest,
  label: label.charAt(0).toUpperCase() + label.slice(1),
}));

/** Keeps only values we recognise, so corrupted storage can never break the screen. */
function sanitize(raw: any): Preferences {
  const pick = <T extends string>(v: any, options: { value: T }[]): T | null =>
    options.some((o) => o.value === v) ? v : null;
  return {
    theme: pick(raw?.theme, THEMES),
    budget: pick(raw?.budget, BUDGETS),
    duration: pick(raw?.duration, DURATIONS),
    style: pick(raw?.style, STYLES),
    interests: Array.isArray(raw?.interests)
      ? raw.interests.filter((i: any) => INTERESTS.some((o) => o.value === i))
      : [],
    startCity: typeof raw?.startCity === 'string' ? raw.startCity.slice(0, 60) : '',
    month: MONTHS.includes(raw?.month) ? raw.month : null,
    notes: typeof raw?.notes === 'string' ? raw.notes.slice(0, 200) : '',
  };
}

export default function TripMatchScreen({ navigation }: any) {
  const [prefs, setPrefs] = useState<Preferences>(EMPTY_PREFERENCES);
  const [results, setResults] = useState<Match[] | null>(null);
  const [error, setError] = useState('');
  const { updateTrip } = useTrip();
  const [explaining, setExplaining] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [explanations, setExplanations] = useState<Record<string, MatchExplanation>>({});

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => raw && setPrefs(sanitize(JSON.parse(raw))))
      .catch(() => {});
  }, []);

  const update = (patch: Partial<Preferences>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    setResults(null);
    setError('');
    setAiNote('');
    setAiSummary('');
    setExplanations({});
  };

  const find = async () => {
    if (explaining) return;
    if (!isValid(prefs)) {
      setError('Pick a preferred experience first.');
      return;
    }
    const local = matchDestinations(prefs, 5);
    setResults(local.slice(0, 3));
    setExplanations({});
    setAiNote('');
    setAiSummary('');
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
    updateTrip({ style: prefs.style ?? '', budgetLevel: prefs.budget ?? '', interests: prefs.interests, startCity: prefs.startCity.trim(), month: prefs.month ?? '' });
    if (!local.length) return;

    // Step 2: ask Gemini to explain the shortlist (the local engine already chose the candidates).
    setExplaining(true);
    try {
      const candidates = local.map((m) => ({
        id: m.destination.id, name: m.destination.name, category: m.destination.category, theme: m.destination.theme,
        budgets: m.destination.budgets, suggestedDays: m.destination.suggestedDays, bestTime: m.destination.bestTime,
        styles: m.destination.styles, experiences: m.destination.experiences.map((e) => `${e.type}: ${e.text}`), tip: m.destination.planningTip,
      }));
      const out = await explainMatches(prefs, candidates, local.map((m) => m.destination.id));
      const byId: Record<string, MatchExplanation> = {};
      out.recommendations.forEach((r) => (byId[r.destinationId] = r));
      setExplanations(byId);
      setAiSummary(out.summary);
    } catch (e) {
      setAiNote(`${e instanceof AiClientError ? e.message : 'The AI explanation is unavailable.'} Showing rule-based results only.`);
    } finally {
      setExplaining(false);
    }
  };

  const toggleInterest = (i: Interest) =>
    update({ interests: prefs.interests.includes(i) ? prefs.interests.filter((x) => x !== i) : [...prefs.interests, i] });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>TRIP MATCH</Text>
        <Text style={styles.title}>Find your kind of trip</Text>
        <Text style={styles.subtitle}>Pick what you like and we'll suggest where to go.</Text>

        <View style={styles.formCard}>

        <Group title="Preferred experience" options={THEMES} value={prefs.theme} onChange={(v) => update({ theme: v })} />
        <Group title="Budget" options={BUDGETS} value={prefs.budget} onChange={(v) => update({ budget: v })} />
        <Group title="Trip duration" options={DURATIONS} value={prefs.duration} onChange={(v) => update({ duration: v })} />
        <Group title="Travel style" options={STYLES} value={prefs.style} onChange={(v) => update({ style: v })} />

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Experiences you enjoy</Text>
          <View style={styles.chipRow}>
            {INTERESTS.map((o) => (
              <Chip key={o.value} label={o.label} active={prefs.interests.includes(o.value)} onPress={() => toggleInterest(o.value)} />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Travel month (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {MONTHS.map((m) => (
                <Chip key={m} label={m} active={prefs.month === m} onPress={() => update({ month: prefs.month === m ? null : m })} />
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Starting city (optional)</Text>
          <TextInput value={prefs.startCity} onChangeText={(v) => update({ startCity: v })} placeholder="e.g. Hyderabad" placeholderTextColor={colors.muted} style={styles.textInput} maxLength={60} accessibilityLabel="Starting city" />
        </View>
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Dietary or accessibility needs (optional)</Text>
          <TextInput value={prefs.notes} onChangeText={(v) => update({ notes: v })} placeholder="e.g. vegetarian, step-free access" placeholderTextColor={colors.muted} style={styles.textInput} maxLength={200} accessibilityLabel="Dietary or accessibility needs" />
        </View>

        </View>

        {error !== '' && <Text style={styles.error}>{error}</Text>}
        <Pressable style={[styles.findBtn, explaining && { opacity: 0.7 }]} onPress={find} disabled={explaining} accessibilityRole="button">
          {explaining ? <ActivityIndicator color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
          <Text style={styles.findText}>{explaining ? 'Asking the AI…' : 'Find my trip'}</Text>
        </Pressable>
        <Text style={styles.note}>The app's rule-based matcher picks the destinations; the AI then explains why they fit you.</Text>
        {aiNote !== '' && <Text style={styles.aiNote}>{aiNote}</Text>}
        {aiSummary !== '' && (
          <View style={styles.aiSummary}>
            <Text style={styles.aiSummaryTitle}>✨ AI summary</Text>
            <Text style={type.body}>{aiSummary}</Text>
          </View>
        )}

        {results && results.length === 0 && <Text style={styles.empty}>No matches. Try fewer preferences.</Text>}
        {results?.map((m, idx) => (
          <Pressable
            key={m.destination.id}
            style={styles.card}
            onPress={() => navigation.navigate('Details', { id: m.destination.id })}
            accessibilityLabel={`${m.destination.name}, open details`}
          >
            <SafeImage uri={m.destination.image} style={styles.cardImg} />
            <View style={styles.cardBody}>
              <Text style={styles.rank}>{idx === 0 ? 'BEST MATCH' : `MATCH #${idx + 1}`}</Text>
              <Text style={styles.cardName}>{m.destination.name}</Text>
              <Text style={styles.cardMeta}>
                {m.destination.category} · {m.destination.location} · {m.destination.suggestedDays}
              </Text>
              {explanations[m.destination.id] ? (
                <View style={styles.aiBox}>
                  <Text style={styles.aiBadge}>✨ AI-EXPLAINED FOR YOU</Text>
                  <Text style={type.body}>{explanations[m.destination.id].why}</Text>
                  {explanations[m.destination.id].tradeoffs !== '' && <Text style={[type.body, { marginTop: 6 }]}><Text style={{ fontWeight: '800' }}>Trade-off: </Text>{explanations[m.destination.id].tradeoffs}</Text>}
                  {explanations[m.destination.id].tips.map((t) => <Text key={t} style={[type.body, { marginTop: 4 }]}>• {t}</Text>)}
                </View>
              ) : (
                !explaining && <Text style={styles.ruleBadge}>RULE-BASED RESULT</Text>
              )}
              <Text style={styles.why}>WHY IT MATCHES</Text>
              {m.reasons.map((r) => (
                <View key={r} style={styles.reasonRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.reasonText}>{r}</Text>
                </View>
              ))}
              <Text style={styles.why}>YOU COULD EXPLORE</Text>
              <Text style={styles.reason}>{m.destination.attractions.map((a) => a.name).join(', ')}</Text>
              <Text style={styles.why}>PLANNING TIP</Text>
              <Text style={styles.reason}>{m.destination.planningTip}</Text>
              <Pressable
                style={styles.planBtn}
                onPress={() => navigation.navigate('Plan', { destination: m.destination.name, interests: prefs.interests, budget: prefs.budget, style: prefs.style })}
              >
                <Ionicons name="map-outline" size={16} color="#fff" />
                <Text style={styles.planText}>Plan this trip</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  brand: { color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 12, marginBottom: 2 },
  title: type.title,
  subtitle: { ...type.body, color: colors.muted, marginTop: 4, marginBottom: 14 },
  formCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, paddingTop: 2, ...shadow },
  group: { marginTop: 16 },
  groupTitle: { fontWeight: '800', color: colors.text, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  textInput: { height: 46, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 15, outlineStyle: 'none' } as any,
  aiNote: { color: colors.warn, fontWeight: '600', lineHeight: 20, marginTop: 10, textAlign: 'center' },
  aiSummary: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 14, marginTop: 14, gap: 4 },
  aiSummaryTitle: { ...type.section, color: colors.primaryDark },
  aiBox: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12, marginTop: 10 },
  aiBadge: { color: colors.primaryDark, fontWeight: '800', fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  ruleBadge: { color: colors.muted, fontWeight: '800', fontSize: 11, letterSpacing: 1, marginTop: 8 },
  error: { color: colors.heart, marginTop: 14, fontWeight: '600' },
  findBtn: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  findText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  note: { color: colors.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
  card: { marginTop: 20, backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  cardImg: { width: '100%', height: 150 },
  cardBody: { padding: 14 },
  rank: { color: colors.accent, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  cardName: { fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 2 },
  cardMeta: { color: colors.muted, marginTop: 2, fontSize: 13 },
  planBtn: { marginTop: 12, backgroundColor: colors.primary, borderRadius: 12, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  planText: { color: '#fff', fontWeight: '700' },
  why: { fontWeight: '800', color: colors.muted, fontSize: 11, letterSpacing: 1, marginTop: 14, marginBottom: 4 },
  reasonRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 4 },
  reasonText: { ...type.body, flex: 1 },
  reason: type.body,
});
