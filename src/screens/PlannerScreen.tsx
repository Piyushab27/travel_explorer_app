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
import { colors, radius, shadow, type } from '../theme';
import { Chip, Group } from '../components/Chips';
import DestinationInput from '../components/DestinationInput';
import SafeImage from '../components/SafeImage';
import {
  Itinerary,
  ItineraryRequest,
  ItinerarySource,
  buildOfflineItinerary,
  checkAi,
  findDestination,
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

  const hero = result ? findDestination(result.request.destination) : undefined;
  const TIME_ICON: Record<string, string> = { Morning: 'sunny-outline', Afternoon: 'partly-sunny-outline', Evening: 'moon-outline' };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>TRIP PLANNER</Text>
        <Text style={styles.title}>Plan your perfect trip</Text>
        <Text style={styles.subtitle}>Tell us where and how you travel, and get a day-by-day itinerary.</Text>

        <View style={[styles.status, aiOnline ? styles.statusOn : styles.statusOff]}>
          <Ionicons name={aiOnline ? 'checkmark-circle' : 'alert-circle'} size={16} color={aiOnline ? colors.success : colors.warn} />
          <Text style={[styles.statusText, { color: aiOnline ? colors.success : colors.warn }]}>
            {aiOnline === null
              ? 'Checking AI planner…'
              : aiOnline
              ? 'AI planner connected'
              : 'AI planner offline: only a basic plan is available'}
          </Text>
        </View>

        {/* Step 1: where, how long, when */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Where and when</Text>
          <Text style={styles.label}>Destination</Text>
          <DestinationInput value={destination} onChange={setDestination} />

          <Text style={styles.label}>Length of trip</Text>
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
        </View>

        {/* Step 2: preferences */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Your style</Text>
          <Group title="Budget" options={BUDGETS} value={budget} onChange={setBudget} />
          <Group title="Travelling as" options={STYLES} value={style} onChange={setStyle} />

          <View style={styles.group}>
            <Text style={styles.groupTitle}>Interests</Text>
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
        </View>

        {error !== '' && (
          <View style={styles.errorBox}>
            <Ionicons name="information-circle" size={18} color={colors.warn} />
            <Text style={styles.error}>{error}</Text>
          </View>
        )}

        <Pressable style={[styles.genBtn, loading && { opacity: 0.7 }]} onPress={generate} disabled={loading} accessibilityRole="button">
          {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
          <Text style={styles.genText}>{loading ? 'Planning your trip…' : 'Create itinerary'}</Text>
        </Pressable>

        {result && (
          <View style={styles.result}>
            {/* Banner: destination photo when we have one, otherwise a solid header */}
            <View style={styles.banner}>
              {hero ? <SafeImage uri={hero.image} style={styles.bannerImg} /> : <View style={[styles.bannerImg, { backgroundColor: colors.primary }]} />}
              <View style={styles.bannerShade} />
              <View style={styles.bannerText}>
                <View style={[styles.badge, result.source === 'ai' ? styles.badgeAi : styles.badgeOffline]}>
                  <Text style={styles.badgeText}>{result.source === 'ai' ? '✨ AI-written plan' : 'Offline plan (not AI)'}</Text>
                </View>
                <Text style={styles.resTitle}>{result.itinerary.title}</Text>
              </View>
            </View>
            {result.itinerary.summary !== '' && <Text style={styles.resSummary}>{result.itinerary.summary}</Text>}

            {result.itinerary.days.map((d) => (
              <View key={d.day} style={styles.dayCard}>
                <View style={styles.dayHead}>
                  <View style={styles.dayNum}>
                    <Text style={styles.dayNumText}>{d.day}</Text>
                  </View>
                  <Text style={styles.dayTitle}>{d.title.replace(/^Day \d+:?\s*/i, '')}</Text>
                </View>
                {d.activities.map((a, idx) => (
                  <View key={idx} style={styles.activity}>
                    <View style={styles.rail}>
                      <View style={styles.dot}>
                        <Ionicons name={TIME_ICON[a.time] as any} size={16} color={colors.primary} />
                      </View>
                      {idx < d.activities.length - 1 && <View style={styles.line} />}
                    </View>
                    <View style={styles.actBody}>
                      <Text style={styles.time}>{a.time.toUpperCase()}</Text>
                      <Text style={styles.actText}>{a.text}</Text>
                      {a.mapQuery !== '' && (
                        <Pressable style={styles.mapPill} onPress={() => openMap(a.mapQuery)} accessibilityLabel={`Open ${a.mapQuery} in Maps`}>
                          <Ionicons name="location" size={13} color={colors.primary} />
                          <Text style={styles.mapLink}>Open in Maps</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ))}

            {result.itinerary.tips.length > 0 && (
              <View style={styles.tipsBox}>
                <View style={styles.tipsHead}>
                  <Ionicons name="bulb-outline" size={18} color={colors.primaryDark} />
                  <Text style={styles.tipsTitle}>Good to know</Text>
                </View>
                {result.itinerary.tips.map((t) => (
                  <Text key={t} style={styles.tipText}>•  {t}</Text>
                ))}
              </View>
            )}
            <Text style={styles.caveat}>{result.itinerary.caveats}</Text>

            <Pressable style={[styles.saveBtn, justSaved && { opacity: 0.6 }]} onPress={save} disabled={justSaved}>
              <Ionicons name={justSaved ? 'checkmark' : 'bookmark-outline'} size={18} color="#fff" />
              <Text style={styles.saveText}>{justSaved ? 'Saved to this device' : 'Save this plan'}</Text>
            </Pressable>
          </View>
        )}

        {saved.length > 0 && (
          <View style={styles.savedBox}>
            <Text style={styles.cardTitle}>Saved plans</Text>
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
  content: { padding: 20, paddingBottom: 60 },
  brand: { color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 12, marginBottom: 2 },
  title: type.title,
  subtitle: { ...type.body, color: colors.muted, marginTop: 4, marginBottom: 14 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, marginBottom: 16 },
  statusOn: { backgroundColor: colors.successSoft },
  statusOff: { backgroundColor: colors.warnSoft },
  statusText: { fontWeight: '600', fontSize: 13, flex: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 16, ...shadow },
  cardTitle: { ...type.section, marginBottom: 2 },
  label: { fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 8, fontSize: 14 },
  group: { marginTop: 16 },
  groupTitle: { fontWeight: '700', color: colors.text, marginBottom: 8, fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  days: { fontSize: 18, fontWeight: '800', color: colors.text, minWidth: 80, textAlign: 'center' },
  notes: {
    minHeight: 76, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: 12, color: colors.text, fontSize: 15, textAlignVertical: 'top', outlineStyle: 'none',
  } as any,
  errorBox: { flexDirection: 'row', gap: 8, backgroundColor: colors.warnSoft, borderRadius: 12, padding: 12, marginBottom: 12 },
  error: { color: colors.warn, fontWeight: '600', lineHeight: 20, flex: 1 },
  genBtn: { backgroundColor: colors.accent, borderRadius: 16, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadow },
  genText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  result: { marginTop: 28 },
  banner: { height: 190, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end' },
  bannerImg: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  bannerShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.42)' },
  bannerText: { padding: 16, gap: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  badgeAi: { backgroundColor: colors.successSoft },
  badgeOffline: { backgroundColor: colors.warnSoft },
  badgeText: { fontWeight: '700', fontSize: 12, color: colors.text },
  resTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: '#fff' },
  resSummary: { ...type.body, marginTop: 14, marginBottom: 4 },

  dayCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginTop: 14, ...shadow },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  dayNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  dayNumText: { color: '#fff', fontWeight: '900' },
  dayTitle: { ...type.section, flex: 1, color: colors.primaryDark },
  activity: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 32 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: colors.primarySoft, marginVertical: 2 },
  actBody: { flex: 1, paddingBottom: 18 },
  time: { color: colors.accent, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  actText: { ...type.body, marginTop: 2 },
  mapPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
  mapLink: { color: colors.primary, fontWeight: '700', fontSize: 12 },

  tipsBox: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 16, marginTop: 14, gap: 6 },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  tipsTitle: { ...type.section, color: colors.primaryDark },
  tipText: type.body,
  caveat: { ...type.caption, marginTop: 14 },
  saveBtn: { marginTop: 16, backgroundColor: colors.primary, borderRadius: 14, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#fff', fontWeight: '800' },

  savedBox: { marginTop: 32 },
  savedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 14, marginTop: 10, gap: 10, ...shadow },
  savedName: { fontWeight: '700', color: colors.text },
  savedMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
