/**
 * Planner screen: builds an editable day-by-day itinerary for a destination the user types or selects.
 * The itinerary comes from Gemini through the Roam India server and is validated before it is shown.
 * If the AI is unavailable the user gets a clearly labelled rule-based "Offline plan" (known places only).
 *
 * Edits: remove or replace an activity, regenerate a day, ask for a cheaper / slower / more adventurous
 * version, or ask the AI to explain its choices. Cost totals are always recalculated by app code.
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
import RichText from '../components/RichText';
import { useTrip } from '../context/TripContext';
import { AiClientError, checkAi, explainItinerary, generateItinerary, reviseItinerary } from '../services/ai';
import { Itinerary, ItineraryRequest, ItinerarySource, buildOfflineItinerary, findDestination, knownFacts } from '../services/itinerary';
import { parseItinerary } from '../services/validate';
import { formatInr, itineraryTotals, parseAmount } from '../utils/budget';

const PLANS_KEY = 'plans:v2';
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
const TIME_ICON: Record<string, string> = { Morning: 'sunny-outline', Afternoon: 'partly-sunny-outline', Evening: 'moon-outline' };

interface SavedPlan {
  id: string;
  savedAt: number;
  request: ItineraryRequest;
  itinerary: Itinerary;
  source: ItinerarySource;
}

export default function PlannerScreen({ route, navigation }: any) {
  const { trip, updateTrip, plan, setPlan, editItinerary, aiContext } = useTrip();

  const [destination, setDestination] = useState(trip.destination);
  const [days, setDays] = useState(trip.days ?? 3);
  const [travelers, setTravelers] = useState(trip.travelers ?? 2);
  const [budgetText, setBudgetText] = useState(trip.budgetInr ? String(trip.budgetInr) : '');
  const [month, setMonth] = useState<string | null>(trip.month || null);
  const [budget, setBudget] = useState<string | null>(trip.budgetLevel || null);
  const [style, setStyle] = useState<string | null>(trip.style || null);
  const [interests, setInterests] = useState<string[]>(trip.interests);
  const [hiddenGems, setHiddenGems] = useState(false);
  const [notes, setNotes] = useState('');

  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  /** Which action is running. Only one AI action runs at a time, which also blocks double taps. */
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<null | (() => void)>(null);
  const [explanation, setExplanation] = useState('');
  const [saved, setSaved] = useState<SavedPlan[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  // Prefill from "Plan this trip" / "Plan a trip" buttons elsewhere in the app.
  const p = route?.params;
  useEffect(() => {
    if (p?.destination) {
      setDestination(p.destination);
      if (Array.isArray(p?.interests)) setInterests(p.interests);
      if (typeof p?.budget === 'string') setBudget(p.budget === 'budget' ? 'budget-friendly' : p.budget);
      if (typeof p?.style === 'string') setStyle(p.style);
    }
  }, [p?.destination, p?.interests, p?.budget, p?.style]);

  // Re-check the AI server every time this screen is opened, so the banner is never stale.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => checkAi().then(setAiOnline));
    return unsub;
  }, [navigation]);

  useEffect(() => {
    checkAi().then(setAiOnline);
    AsyncStorage.getItem(PLANS_KEY)
      .then((raw) => {
        if (!raw) return;
        const list = JSON.parse(raw);
        // Re-validate saved plans so old or corrupt data can never break the screen.
        setSaved(
          (Array.isArray(list) ? list : [])
            .map((s: any) => ({ ...s, itinerary: parseItinerary(s?.itinerary) }))
            .filter((s: any) => s.itinerary && s.request),
        );
      })
      .catch(() => {});
  }, []);

  const persist = (plans: SavedPlan[]) => {
    setSaved(plans);
    AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans)).catch(() => {});
  };

  const friendly = (e: unknown) => (e instanceof AiClientError ? e.message : 'Something went wrong. Please try again.');

  const generate = async () => {
    if (busy) return;
    if (!destination.trim()) {
      setError('Enter a destination first.');
      setRetry(null);
      return;
    }
    setError('');
    setRetry(null);
    setBusy('generate');
    setExplanation('');
    setJustSaved(false);
    const budgetInr = parseAmount(budgetText);
    const request: ItineraryRequest = {
      destination: destination.trim(), days, month: month ?? '', budget: budget ?? '', style: style ?? '', interests,
      preferHiddenGems: hiddenGems, notes: notes.trim(), travelers, budgetInr,
    };
    updateTrip({ destination: request.destination, days, travelers, budgetInr, style: style ?? '', budgetLevel: budget ?? '', interests, month: month ?? '' });
    try {
      const itinerary = await generateItinerary(request);
      setAiOnline(true);
      if (!itinerary.days.length) setError(itinerary.caveats || 'The planner could not build a plan for that place.');
      else setPlan({ itinerary, source: 'ai', request });
    } catch (e) {
      setAiOnline(false);
      const offline = buildOfflineItinerary(request);
      if (offline) {
        setError(`${friendly(e)} Showing a basic offline plan instead.`);
        setPlan({ itinerary: offline, source: 'offline', request });
      } else {
        setError(`${friendly(e)} The offline planner only covers places in this app, so try one of those.`);
      }
      if (e instanceof AiClientError && e.retryable) setRetry(() => generate);
    } finally {
      setBusy(null);
    }
  };

  /** Runs one AI edit and replaces the plan with the validated result. */
  const revise = async (key: string, instruction: string, opts: { dayIndex?: number; activityIndex?: number } = {}) => {
    if (busy || !plan) return;
    if (plan.source !== 'ai') {
      setError('AI edits need the AI planner. You can still remove activities from an offline plan.');
      setRetry(null);
      return;
    }
    setError('');
    setRetry(null);
    setBusy(key);
    try {
      const dest = findDestination(plan.request.destination);
      const itinerary = await reviseItinerary(plan.itinerary, instruction, { ...opts, facts: dest ? knownFacts(dest) : '' });
      setPlan({ ...plan, itinerary });
      setExplanation('');
      setJustSaved(false);
    } catch (e) {
      setError(friendly(e));
      if (e instanceof AiClientError && e.retryable) setRetry(() => () => revise(key, instruction, opts));
    } finally {
      setBusy(null);
    }
  };

  const explain = async () => {
    if (busy || !plan) return;
    if (plan.source !== 'ai') {
      setError('Explanations need the AI planner.');
      return;
    }
    setError('');
    setBusy('explain');
    try {
      setExplanation(await explainItinerary(plan.itinerary));
    } catch (e) {
      setError(friendly(e));
      if (e instanceof AiClientError && e.retryable) setRetry(() => explain);
    } finally {
      setBusy(null);
    }
  };

  const removeActivity = (dayIdx: number, actId: string) => {
    editItinerary((it) => ({ ...it, days: it.days.map((d, i) => (i === dayIdx ? { ...d, activities: d.activities.filter((a) => a.id !== actId) } : d)) }));
    setJustSaved(false);
    setExplanation('');
  };

  const save = () => {
    if (!plan) return;
    persist([{ id: String(Date.now()), savedAt: Date.now(), ...plan }, ...saved].slice(0, 20));
    setJustSaved(true);
  };

  const toggleInterest = (i: string) => setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  const openMap = (q: string) => q && Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);

  const hero = plan ? findDestination(plan.request.destination) : undefined;
  const totals = plan ? itineraryTotals(plan.itinerary.days) : null;
  const isBusy = (k: string) => busy === k;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>TRIP PLANNER</Text>
        <Text style={styles.title}>Plan your perfect trip</Text>
        <Text style={styles.subtitle}>Tell us where and how you travel, then edit the plan until it fits.</Text>

        <View style={[styles.status, aiOnline ? styles.statusOn : styles.statusOff]}>
          <Ionicons name={aiOnline ? 'checkmark-circle' : 'alert-circle'} size={16} color={aiOnline ? colors.success : colors.warn} />
          <Text style={[styles.statusText, { color: aiOnline ? colors.success : colors.warn }]}>
            {aiOnline === null ? 'Checking AI planner…' : aiOnline ? 'AI planner connected' : 'AI planner offline: only a basic plan is available'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Where and when</Text>
          <Text style={styles.label}>Destination</Text>
          <DestinationInput value={destination} onChange={setDestination} />

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Length of trip</Text>
              <Stepper value={days} unit="day" min={1} max={14} onChange={setDays} label="days" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Travellers</Text>
              <Stepper value={travelers} unit="person" plural="people" min={1} max={12} onChange={setTravelers} label="travellers" />
            </View>
          </View>

          <Text style={styles.label}>Total budget in ₹ (optional)</Text>
          <TextInput
            value={budgetText}
            onChangeText={setBudgetText}
            placeholder="e.g. 20000"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            style={styles.input}
            accessibilityLabel="Total budget in rupees"
          />

          <Text style={styles.label}>Travel month (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.row}>
              {MONTHS.map((m) => (
                <Chip key={m} label={m} active={month === m} onPress={() => setMonth(month === m ? null : m)} />
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Your style</Text>
          <Group title="Budget level" options={BUDGETS} value={budget} onChange={setBudget} />
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
            placeholder="e.g. vegetarian, travelling with elderly parents, avoid a packed schedule"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={400}
            style={styles.notes}
          />
        </View>

        {error !== '' && (
          <View style={styles.errorBox}>
            <Ionicons name="information-circle" size={18} color={colors.warn} />
            <View style={{ flex: 1 }}>
              <Text style={styles.error}>{error}</Text>
              {retry && !busy && (
                <Pressable onPress={retry} style={styles.retryBtn} accessibilityRole="button">
                  <Ionicons name="refresh" size={14} color={colors.warn} />
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        <Pressable style={[styles.genBtn, busy && { opacity: 0.7 }]} onPress={generate} disabled={!!busy} accessibilityRole="button">
          {isBusy('generate') ? <ActivityIndicator color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
          <Text style={styles.genText}>{isBusy('generate') ? 'Planning your trip…' : plan ? 'Create a new itinerary' : 'Create itinerary'}</Text>
        </Pressable>

        {plan && totals && (
          <View style={styles.result}>
            <View style={styles.banner}>
              {hero ? <SafeImage uri={hero.image} style={styles.bannerImg} /> : <View style={[styles.bannerImg, { backgroundColor: colors.primary }]} />}
              <View style={styles.bannerShade} />
              <View style={styles.bannerText}>
                <View style={[styles.badge, plan.source === 'ai' ? styles.badgeAi : styles.badgeOffline]}>
                  <Text style={styles.badgeText}>{plan.source === 'ai' ? '✨ AI-written plan' : 'Offline plan (not AI)'}</Text>
                </View>
                <Text style={styles.resTitle}>{plan.itinerary.title}</Text>
              </View>
            </View>
            {plan.itinerary.summary !== '' && <Text style={styles.resSummary}>{plan.itinerary.summary}</Text>}

            {/* Whole-plan adjustments */}
            <Text style={styles.sectionLabel}>ADJUST THIS PLAN</Text>
            <View style={styles.row}>
              <ActionChip label="Lower budget" busy={isBusy('all-cheap')} disabled={!!busy} onPress={() => revise('all-cheap', 'Make the whole plan cheaper: swap costly activities for lower-cost ones and lower the estimates accordingly.')} />
              <ActionChip label="More relaxed" busy={isBusy('all-relax')} disabled={!!busy} onPress={() => revise('all-relax', 'Make the pace more relaxed: fewer activities per day, more rest time.')} />
              <ActionChip label="More adventurous" busy={isBusy('all-adv')} disabled={!!busy} onPress={() => revise('all-adv', 'Make the plan more adventurous with more active, outdoor experiences.')} />
              <ActionChip label="Explain choices" busy={isBusy('explain')} disabled={!!busy} onPress={explain} />
            </View>
            {plan.source !== 'ai' && <Text style={styles.caption}>AI adjustments are only available for AI-written plans.</Text>}

            {explanation !== '' && (
              <View style={styles.explainBox}>
                <Text style={styles.tipsTitle}>Why this plan</Text>
                <RichText text={explanation} />
              </View>
            )}

            {plan.itinerary.days.map((d, dayIdx) => (
              <View key={dayIdx} style={styles.dayCard}>
                <View style={styles.dayHead}>
                  <View style={styles.dayNum}>
                    <Text style={styles.dayNumText}>{d.day}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dayTitle}>{d.title.replace(/^Day \d+:?\s*/i, '')}</Text>
                    {totals.perDay[dayIdx] > 0 && <Text style={styles.dayCost}>≈ {formatInr(totals.perDay[dayIdx])} estimated</Text>}
                  </View>
                  {plan.source === 'ai' && (
                    <Pressable
                      onPress={() => revise(`day-${dayIdx}`, `Regenerate day ${d.day} with a fresh set of activities.`, { dayIndex: d.day })}
                      disabled={!!busy}
                      style={[styles.iconBtn, busy && { opacity: 0.5 }]}
                      accessibilityLabel={`Regenerate day ${d.day}`}
                    >
                      {isBusy(`day-${dayIdx}`) ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh" size={18} color={colors.primary} />}
                    </Pressable>
                  )}
                </View>
                {d.transportNote !== '' && (
                  <Text style={styles.transport}>
                    <Ionicons name="car-outline" size={13} color={colors.muted} /> {d.transportNote}
                  </Text>
                )}
                {d.activities.length === 0 && <Text style={styles.caption}>No activities left on this day.</Text>}
                {d.activities.map((a, idx) => (
                  <View key={a.id} style={styles.activity}>
                    <View style={styles.rail}>
                      <View style={styles.dot}>
                        <Ionicons name={TIME_ICON[a.time] as any} size={16} color={colors.primary} />
                      </View>
                      {idx < d.activities.length - 1 && <View style={styles.line} />}
                    </View>
                    <View style={styles.actBody}>
                      <Text style={styles.time}>{a.time.toUpperCase()}</Text>
                      <Text style={styles.actText}>{a.text}</Text>
                      <View style={styles.metaRow}>
                        {a.durationHours !== null && <Text style={styles.meta}>~{a.durationHours} h</Text>}
                        {a.estimatedCostInr !== null && <Text style={styles.meta}>≈ {formatInr(a.estimatedCostInr)} (estimate)</Text>}
                      </View>
                      <View style={styles.actionRow}>
                        {a.mapQuery !== '' && (
                          <Pressable style={styles.mapPill} onPress={() => openMap(a.mapQuery)} accessibilityLabel={`Open ${a.mapQuery} in Maps`}>
                            <Ionicons name="location" size={13} color={colors.primary} />
                            <Text style={styles.mapLink}>Maps</Text>
                          </Pressable>
                        )}
                        {plan.source === 'ai' && (
                          <Pressable
                            style={[styles.mapPill, busy && { opacity: 0.5 }]}
                            disabled={!!busy}
                            onPress={() => revise(`act-${dayIdx}-${idx}`, `Replace this activity with a different one in the same time slot: "${a.text}".`, { dayIndex: d.day, activityIndex: idx + 1 })}
                            accessibilityLabel="Replace this activity"
                          >
                            {isBusy(`act-${dayIdx}-${idx}`) ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="swap-horizontal" size={13} color={colors.primary} />}
                            <Text style={styles.mapLink}>Replace</Text>
                          </Pressable>
                        )}
                        <Pressable style={[styles.mapPill, styles.removePill]} onPress={() => removeActivity(dayIdx, a.id)} accessibilityLabel="Remove this activity">
                          <Ionicons name="trash-outline" size={13} color={colors.heart} />
                          <Text style={[styles.mapLink, { color: colors.heart }]}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            <View style={styles.totalCard}>
              <Text style={styles.cardTitle}>Estimated activity costs</Text>
              <Text style={styles.totalAmount}>{formatInr(totals.total)}</Text>
              <Text style={styles.caption}>
                Adds up the rough estimates above for {plan.request.travelers ?? 'your'} traveller(s).
                {totals.unknownCount > 0 ? ` ${totals.unknownCount} activities have no estimate, so the real total is higher.` : ''} Stay, food and transport are not all included.
                {plan.itinerary.budgetAssumptions ? ` ${plan.itinerary.budgetAssumptions}` : ''}
              </Text>
              <Pressable style={styles.budgetBtn} onPress={() => navigation.navigate('Budget')}>
                <Ionicons name="wallet-outline" size={16} color={colors.primary} />
                <Text style={styles.mapLink}>Open budget planner</Text>
              </Pressable>
            </View>

            {plan.itinerary.alternatives.length > 0 && <ListBox icon="shuffle-outline" title="Optional alternatives" items={plan.itinerary.alternatives} />}
            {plan.itinerary.bookingReminders.length > 0 && <ListBox icon="alarm-outline" title="Book or check ahead" items={plan.itinerary.bookingReminders} />}
            {plan.itinerary.tips.length > 0 && <ListBox icon="bulb-outline" title="Good to know" items={plan.itinerary.tips} />}
            <Text style={styles.caveat}>{plan.itinerary.caveats}</Text>

            <Pressable style={[styles.saveBtn, justSaved && { opacity: 0.6 }]} onPress={save} disabled={justSaved}>
              <Ionicons name={justSaved ? 'checkmark' : 'bookmark-outline'} size={18} color="#fff" />
              <Text style={styles.saveText}>{justSaved ? 'Saved to this device' : 'Save this plan'}</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Concierge', { prompt: 'Explain the trade-offs of my itinerary and suggest improvements.' })} style={styles.askLink}>
              <Ionicons name="chatbubbles-outline" size={16} color={colors.primary} />
              <Text style={styles.mapLink}>Discuss this plan with Travel AI</Text>
            </Pressable>
          </View>
        )}

        {saved.length > 0 && (
          <View style={styles.savedBox}>
            <Text style={styles.cardTitle}>Saved plans</Text>
            {saved.map((s) => (
              <View key={s.id} style={styles.savedRow}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => {
                    setPlan({ itinerary: s.itinerary, source: s.source, request: s.request });
                    updateTrip({ destination: s.request.destination, days: s.request.days });
                    setJustSaved(true);
                    setError('');
                    setExplanation('');
                  }}
                >
                  <Text style={styles.savedName}>{s.itinerary.title}</Text>
                  <Text style={styles.savedMeta}>{s.source === 'ai' ? 'AI' : 'Offline'} · {new Date(s.savedAt).toLocaleDateString()}</Text>
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

function Stepper({ value, unit, plural, min, max, onChange, label }: { value: number; unit: string; plural?: string; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - 1))} accessibilityLabel={`Fewer ${label}`}>
        <Ionicons name="remove" size={18} color={colors.primary} />
      </Pressable>
      <Text style={styles.days}>{value} {value === 1 ? unit : plural ?? `${unit}s`}</Text>
      <Pressable style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + 1))} accessibilityLabel={`More ${label}`}>
        <Ionicons name="add" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function ActionChip({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy: boolean; disabled: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.actionChip, disabled && !busy && { opacity: 0.5 }]} accessibilityRole="button">
      {busy && <ActivityIndicator size="small" color={colors.accent} />}
      <Text style={styles.actionChipText}>{label}</Text>
    </Pressable>
  );
}

function ListBox({ icon, title, items }: { icon: string; title: string; items: string[] }) {
  return (
    <View style={styles.tipsBox}>
      <View style={styles.tipsHead}>
        <Ionicons name={icon as any} size={18} color={colors.primaryDark} />
        <Text style={styles.tipsTitle}>{title}</Text>
      </View>
      {items.map((t) => (
        <Text key={t} style={type.body}>•  {t}</Text>
      ))}
    </View>
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
  twoCol: { flexDirection: 'row', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  days: { fontSize: 15, fontWeight: '800', color: colors.text, minWidth: 64, textAlign: 'center' },
  input: { height: 46, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 15, outlineStyle: 'none' } as any,
  notes: { minHeight: 76, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 15, textAlignVertical: 'top', outlineStyle: 'none' } as any,
  errorBox: { flexDirection: 'row', gap: 8, backgroundColor: colors.warnSoft, borderRadius: 12, padding: 12, marginBottom: 12 },
  error: { color: colors.warn, fontWeight: '600', lineHeight: 20 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.warn, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { color: colors.warn, fontWeight: '700', fontSize: 13 },
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
  sectionLabel: { color: colors.muted, fontWeight: '800', fontSize: 11, letterSpacing: 1, marginTop: 14, marginBottom: 8 },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentSoft, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  actionChipText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  caption: { ...type.caption, marginTop: 6 },
  explainBox: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 16, marginTop: 14, gap: 6 },

  dayCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginTop: 14, ...shadow },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  dayNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  dayNumText: { color: '#fff', fontWeight: '900' },
  dayTitle: { ...type.section, color: colors.primaryDark },
  dayCost: { color: colors.muted, fontSize: 12, marginTop: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  transport: { ...type.caption, marginBottom: 12 },
  activity: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 32 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: colors.primarySoft, marginVertical: 2 },
  actBody: { flex: 1, paddingBottom: 18 },
  time: { color: colors.accent, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  actText: { ...type.body, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  meta: { color: colors.muted, fontSize: 12 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  mapPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  removePill: { backgroundColor: '#FDECEF' },
  mapLink: { color: colors.primary, fontWeight: '700', fontSize: 12 },

  totalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginTop: 14, gap: 4, ...shadow },
  totalAmount: { fontSize: 28, fontWeight: '900', color: colors.primaryDark },
  budgetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  tipsBox: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 16, marginTop: 14, gap: 6 },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  tipsTitle: { ...type.section, color: colors.primaryDark },
  caveat: { ...type.caption, marginTop: 14 },
  saveBtn: { marginTop: 16, backgroundColor: colors.primary, borderRadius: 14, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#fff', fontWeight: '800' },
  askLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 14 },

  savedBox: { marginTop: 32 },
  savedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 14, marginTop: 10, gap: 10, ...shadow },
  savedName: { fontWeight: '700', color: colors.text },
  savedMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
