/**
 * Planner screen: builds a day-by-day itinerary for a destination the user types or selects.
 * It asks the Roam India server, which calls a real Gemini model. If the server is unreachable
 * or has no API key, it shows a clearly labelled rule-based "Offline plan" instead (known
 * destinations only). Plans can be saved on the device.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';
import { Chip, Group } from '../components/Chips';
import DestinationInput from '../components/DestinationInput';
import {
  Itinerary,
  ItineraryRequest,
  ItinerarySource,
  buildOfflineItinerary,
  checkAi,
  generateAiItinerary,
} from '../services/itinerary';

const PLANS_KEY = 'plans:v1';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BUDGETS = [
  { value: 'budget-friendly', label: 'Budget-friendly' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'premium', label: 'Premium' },
];
const STYLES = [
  { value: 'solo', label: 'Solo' },
  { value: 'family', label: 'Family' },
  { value: 'couple', label: 'Couple' },
  { value: 'friends', label: 'Friends' },
];
const INTERESTS = ['food', 'cafes', 'markets', 'nature', 'wellness', 'shopping', 'adventure'];

interface SavedPlan {
  id: string;
  savedAt: number;
  request: ItineraryRequest;
  itinerary: Itinerary;
  source: ItinerarySource;
}

export default function PlannerScreen({ route }: any) {
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState(3);
  const [month, setMonth] = useState<string | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [hiddenGems, setHiddenGems] = useState(false);
  const [notes, setNotes] = useState('');

  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ itinerary: Itinerary; source: ItinerarySource; request: ItineraryRequest } | null>(null);
  const [saved, setSaved] = useState<SavedPlan[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  // Prefill from "Plan this trip" / "Plan a trip" buttons elsewhere in the app.
  const p = route?.params;
  useEffect(() => {
    if (p?.destination) setDestination(p.destination);
    if (Array.isArray(p?.interests)) setInterests(p.interests);
    if (typeof p?.budget === 'string') setBudget(p.budget === 'budget' ? 'budget-friendly' : p.budget);
    if (typeof p?.style === 'string') setStyle(p.style);
    setResult(null);
  }, [p?.destination, p?.interests, p?.budget, p?.style]);

  useEffect(() => {
    checkAi().then(setAiOnline);
    AsyncStorage.getItem(PLANS_KEY)
      .then((raw) => raw && setSaved(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const persist = (plans: SavedPlan[]) => {
    setSaved(plans);
    AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans)).catch(() => {});
  };

  const generate = async () => {
    if (!destination.trim()) {
      setError('Enter a destination first.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    setJustSaved(false);
    const request: ItineraryRequest = {
      destination: destination.trim(),
      days,
      month: month ?? '',
      budget: budget ?? '',
      style: style ?? '',
      interests,
      preferHiddenGems: hiddenGems,
      notes: notes.trim(),
    };
    try {
      const itinerary = await generateAiItinerary(request);
      setAiOnline(true);
      if (!itinerary.days.length) {
        setError(itinerary.caveats || 'The planner could not build a plan for that place.');
      } else {
        setResult({ itinerary, source: 'ai', request });
      }
    } catch (e: any) {
      setAiOnline(false);
      const offline = buildOfflineItinerary(request);
      if (offline) {
        setError(`${e?.message || 'AI unavailable'} Showing a basic offline plan instead.`);
        setResult({ itinerary: offline, source: 'offline', request });
      } else {
        setError(`${e?.message || 'AI unavailable'} The offline planner only covers places in this app, so try one of those.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!result) return;
    persist([{ id: String(Date.now()), savedAt: Date.now(), ...result }, ...saved].slice(0, 20));
    setJustSaved(true);
  };

  const toggleInterest = (i: string) =>
    setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));

  const openMap = (q: string) =>
    q && Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Trip Planner</Text>
        <Text style={styles.subtitle}>Get a day-by-day itinerary for any place in India.</Text>

        <View style={[styles.status, aiOnline ? styles.statusOn : styles.statusOff]}>
          <Ionicons name={aiOnline ? 'checkmark-circle' : 'alert-circle'} size={16} color={aiOnline ? '#1B7F4B' : '#9A5B00'} />
          <Text style={[styles.statusText, { color: aiOnline ? '#1B7F4B' : '#9A5B00' }]}>
            {aiOnline === null
              ? 'Checking AI planner…'
              : aiOnline
              ? 'AI planner connected'
              : 'AI planner offline: only a basic plan is available'}
          </Text>
        </View>

        <Text style={styles.label}>Where to?</Text>
        <DestinationInput value={destination} onChange={setDestination} />

        <Text style={styles.label}>How many days?</Text>
        <View style={styles.stepper}>
          <Pressable style={styles.stepBtn} onPress={() => setDays((d) => Math.max(1, d - 1))} accessibilityLabel="Fewer days">
            <Ionicons name="remove" size={20} color={colors.primary} />
          </Pressable>
          <Text style={styles.days}>{days} {days === 1 ? 'day' : 'days'}</Text>
          <Pressable style={styles.stepBtn} onPress={() => setDays((d) => Math.min(14, d + 1))} accessibilityLabel="More days">
            <Ionicons name="add" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <Text style={styles.label}>Travel month (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>
            {MONTHS.map((m) => (
              <Chip key={m} label={m} active={month === m} onPress={() => setMonth(month === m ? null : m)} />
            ))}
          </View>
        </ScrollView>

        <Group title="Budget" options={BUDGETS} value={budget} onChange={setBudget} />
        <Group title="Travel style" options={STYLES} value={style} onChange={setStyle} />

        <View style={styles.group}>
          <Text style={styles.label}>Interests</Text>
          <View style={styles.row}>
            {INTERESTS.map((i) => (
              <Chip key={i} label={i.charAt(0).toUpperCase() + i.slice(1)} active={interests.includes(i)} onPress={() => toggleInterest(i)} />
            ))}
          </View>
        </View>

        <View style={[styles.group, { alignSelf: 'flex-start' }]}>
          <Chip label="💎 Prefer hidden gems" active={hiddenGems} onPress={() => setHiddenGems((v) => !v)} />
        </View>

        <Text style={styles.label}>Anything else? (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. vegetarian, travelling with elderly parents, love photography"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={400}
          style={styles.notes}
        />

        {error !== '' && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.genBtn, loading && { opacity: 0.7 }]} onPress={generate} disabled={loading} accessibilityRole="button">
          {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
          <Text style={styles.genText}>{loading ? 'Planning your trip…' : 'Create itinerary'}</Text>
        </Pressable>

        {result && (
          <View style={styles.result}>
            <View style={[styles.badge, result.source === 'ai' ? styles.badgeAi : styles.badgeOffline]}>
              <Text style={styles.badgeText}>{result.source === 'ai' ? '✨ AI-written plan' : 'Offline plan (not AI)'}</Text>
            </View>
            <Text style={styles.resTitle}>{result.itinerary.title}</Text>
            <Text style={styles.resSummary}>{result.itinerary.summary}</Text>

            {result.itinerary.days.map((d) => (
              <View key={d.day} style={styles.day}>
                <Text style={styles.dayTitle}>Day {d.day}: {d.title.replace(/^Day \d+:?\s*/i, '')}</Text>
                {d.activities.map((a, idx) => (
                  <View key={idx} style={styles.activity}>
                    <Text style={styles.time}>{a.time}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actText}>{a.text}</Text>
                      {a.mapQuery !== '' && (
                        <Pressable onPress={() => openMap(a.mapQuery)}>
                          <Text style={styles.mapLink}>View on Maps</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ))}

            {result.itinerary.tips.length > 0 && (
              <>
                <Text style={styles.dayTitle}>Tips</Text>
                {result.itinerary.tips.map((t) => (
                  <Text key={t} style={styles.actText}>• {t}</Text>
                ))}
              </>
            )}
            <Text style={styles.caveat}>{result.itinerary.caveats}</Text>

            <Pressable style={[styles.saveBtn, justSaved && { opacity: 0.6 }]} onPress={save} disabled={justSaved}>
              <Ionicons name={justSaved ? 'checkmark' : 'bookmark-outline'} size={18} color={colors.primary} />
              <Text style={styles.saveText}>{justSaved ? 'Saved' : 'Save this plan'}</Text>
            </Pressable>
          </View>
        )}

        {saved.length > 0 && (
          <View style={styles.savedBox}>
            <Text style={styles.resTitle}>Saved plans</Text>
            {saved.map((s) => (
              <View key={s.id} style={styles.savedRow}>
                <Pressable style={{ flex: 1 }} onPress={() => { setResult({ itinerary: s.itinerary, source: s.source, request: s.request }); setJustSaved(true); setError(''); }}>
                  <Text style={styles.savedName}>{s.itinerary.title}</Text>
                  <Text style={styles.savedMeta}>
                    {s.source === 'ai' ? 'AI' : 'Offline'} · {new Date(s.savedAt).toLocaleDateString()}
                  </Text>
                </Pressable>
                <Pressable onPress={() => persist(saved.filter((x) => x.id !== s.id))} hitSlop={8} accessibilityLabel="Delete saved plan">
                  <Ionicons name="trash-outline" size={20} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: '900', color: colors.text },
  subtitle: { color: colors.muted, fontSize: 15, marginBottom: 12 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 12, marginBottom: 6 },
  statusOn: { backgroundColor: '#E6F6EC' },
  statusOff: { backgroundColor: '#FFF3DC' },
  statusText: { fontWeight: '600', fontSize: 13, flex: 1 },
  label: { fontWeight: '800', color: colors.text, marginTop: 16, marginBottom: 8 },
  group: { marginTop: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  days: { fontSize: 18, fontWeight: '800', color: colors.text, minWidth: 80, textAlign: 'center' },
  notes: {
    minHeight: 76, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: 12, color: colors.text, textAlignVertical: 'top', outlineStyle: 'none',
  } as any,
  error: { color: '#9A5B00', marginTop: 14, fontWeight: '600', lineHeight: 20 },
  genBtn: { marginTop: 20, backgroundColor: colors.accent, borderRadius: 14, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  genText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  result: { marginTop: 24, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, marginBottom: 8 },
  badgeAi: { backgroundColor: '#E6F6EC' },
  badgeOffline: { backgroundColor: '#FFF3DC' },
  badgeText: { fontWeight: '700', fontSize: 12, color: colors.text },
  resTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  resSummary: { color: colors.text, lineHeight: 21, marginTop: 4 },
  day: { marginTop: 16 },
  dayTitle: { fontWeight: '800', fontSize: 16, color: colors.primaryDark, marginTop: 12, marginBottom: 6 },
  activity: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  time: { width: 72, color: colors.accent, fontWeight: '800', fontSize: 12 },
  actText: { color: colors.text, lineHeight: 20 },
  mapLink: { color: colors.primary, fontWeight: '600', fontSize: 12, marginTop: 2 },
  caveat: { color: colors.muted, fontSize: 12, marginTop: 14, lineHeight: 18 },
  saveBtn: { marginTop: 14, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveText: { color: colors.primary, fontWeight: '700' },
  savedBox: { marginTop: 28 },
  savedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 12, marginTop: 8, gap: 10 },
  savedName: { fontWeight: '700', color: colors.text },
  savedMeta: { color: colors.muted, fontSize: 12 },
});
