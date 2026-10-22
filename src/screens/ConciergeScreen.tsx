/**
 * Travel AI: a conversational concierge powered by Gemini (through the Roam India server).
 *  - Keeps the active trip (destination, days, budget, travellers, itinerary) as context, so follow-ups work.
 *  - Questions that depend on current facts (visa rules, advisories, exchange rates...) use Google Search
 *    grounding on the server and show the sources it returned. If research is unavailable the answer is
 *    clearly marked as not verified.
 *  - It only gives information. It never books or reserves anything.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, type } from '../theme';
import { Chip } from '../components/Chips';
import RichText from '../components/RichText';
import SafeImage from '../components/SafeImage';
import { ALLOWED_DESTINATIONS, ChatMessage, useTrip } from '../context/TripContext';
import { DESTINATIONS } from '../data/destinations';
import { AiClientError, chat, checkAi } from '../services/ai';
import { newId } from '../services/itinerary';
import { formatInr } from '../utils/budget';

const SUGGESTIONS = [
  'Plan a five-day trip to Goa under ₹20,000',
  'Which is better for my family: Goa or Munnar?',
  'I have only three days. What should I skip?',
  'Suggest destinations for a premium experience',
  'Find destinations for wildlife and nature',
  'Suggest cafés, local food and markets for a short trip to Jaipur',
];
const PURPOSES = ['Tourism', 'Business', 'Study', 'Transit'];

export default function ConciergeScreen({ navigation, route }: any) {
  const { trip, plan, messages, setMessages, aiContext, newConversation } = useTrip();
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [showVisa, setShowVisa] = useState(false);
  const [visa, setVisa] = useState({ nationality: '', residence: '', destination: '', purpose: 'Tourism', dates: '', stay: '' });
  const [visaError, setVisaError] = useState('');
  const scroller = useRef<any>(null);
  // Remembers whether the last request wanted web research, so Retry repeats it exactly.
  const lastForce = useRef(false);

  useEffect(() => {
    checkAi().then(setAiOnline);
    // Re-check whenever the screen is opened, so the offline banner is never stale.
    const unsub = navigation.addListener('focus', () => checkAi().then(setAiOnline));
    return unsub;
  }, [navigation]);

  // Prefill (never auto-send) when another screen sends the user here with a suggested question.
  useEffect(() => {
    if (route?.params?.prompt) setDraft(String(route.params.prompt).slice(0, 600));
  }, [route?.params?.prompt]);

  useEffect(() => {
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length, loading]);

  /** Sends the conversation so far to the server. */
  const ask = async (history: ChatMessage[], force: boolean) => {
    setLoading(true);
    setError(null);
    lastForce.current = force;
    try {
      const reply = await chat(
        history.slice(-12).map((m) => ({ role: m.role, text: m.text })),
        aiContext(),
        ALLOWED_DESTINATIONS,
        force,
      );
      setAiOnline(true);
      setMessages((cur) => [
        ...cur,
        { id: newId(), role: 'assistant', text: reply.reply, followUps: reply.followUps, destinationIds: reply.destinationIds, research: reply.research },
      ]);
    } catch (e) {
      if (e instanceof AiClientError) {
        setError({ message: e.message, retryable: e.retryable });
        if (e.code === 'NETWORK' || e.code === 'NO_KEY') setAiOnline(false);
      } else {
        setError({ message: 'Something went wrong. Please try again.', retryable: true });
      }
    } finally {
      setLoading(false);
    }
  };

  /** Guards against double taps: nothing is sent while a request is running. */
  const send = (text: string, force = false) => {
    const clean = text.trim();
    if (!clean || loading) return;
    const next = [...messages, { id: newId(), role: 'user' as const, text: clean.slice(0, 600) }];
    setMessages(next);
    setDraft('');
    ask(next, force);
  };

  const retry = () => {
    if (!loading) ask(messages, lastForce.current);
  };

  const sendVisa = () => {
    if (!visa.nationality.trim() || !visa.destination.trim()) {
      setVisaError("Add your passport nationality and the destination country. I won't guess your nationality.");
      return;
    }
    setVisaError('');
    const parts = [
      `Visa and entry help. Passport nationality: ${visa.nationality.trim()}.`,
      visa.residence.trim() ? `Country of residence: ${visa.residence.trim()}.` : '',
      `Destination country: ${visa.destination.trim()}.`,
      `Purpose: ${visa.purpose}.`,
      visa.dates.trim() ? `Travel dates: ${visa.dates.trim()}.` : '',
      visa.stay.trim() ? `Length of stay: ${visa.stay.trim()}.` : '',
      'Explain the likely entry or visa options, eligibility considerations, documents, how to apply, official government links and any official fees, and what I should confirm. Do not guarantee approval.',
    ].filter(Boolean);
    setShowVisa(false);
    send(parts.join(' '), true);
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const contextBits = [
    trip.destination,
    trip.days ? `${trip.days} days` : '',
    trip.travelers ? `${trip.travelers} travellers` : '',
    trip.budgetInr ? formatInr(trip.budgetInr) : '',
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>TRAVEL AI</Text>
            <Text style={styles.title}>Ask anything</Text>
          </View>
          {messages.length > 0 && (
            <Pressable
              onPress={() => {
                newConversation();
                setError(null);
              }}
              style={styles.newBtn}
              accessibilityLabel="Start a new conversation"
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.newText}>New chat</Text>
            </Pressable>
          )}
        </View>

        {aiOnline === false && (
          <View style={styles.offline}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warn} />
            <Text style={styles.offlineText}>The AI server is not reachable. You can still browse destinations, search and use Trip Match offline.</Text>
          </View>
        )}
        {contextBits.length > 0 && (
          <View style={styles.contextPill}>
            <Ionicons name="navigate-circle-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.contextText} numberOfLines={1}>Planning: {contextBits.join(' · ')}</Text>
          </View>
        )}

        <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={styles.chat} keyboardShouldPersistTaps="handled">
          {messages.length === 0 && (
            <View>
              <View style={styles.welcome}>
                <Text style={styles.welcomeTitle}>Hi, I'm your travel concierge ✨</Text>
                <Text style={type.body}>
                  Ask me to plan a trip, compare places, split a budget or explain what to skip. I remember your trip as we chat. I can only give information: I can't book or buy anything.
                </Text>
              </View>
              <Text style={styles.sectionLabel}>TRY ASKING</Text>
              <View style={styles.chipWrap}>
                {SUGGESTIONS.map((s) => (
                  <Chip key={s} label={s} active={false} onPress={() => send(s)} />
                ))}
                {plan && <Chip label="Explain my itinerary" active={false} onPress={() => send('Explain the trade-offs of my itinerary and suggest improvements.')} />}
              </View>
            </View>
          )}

          {messages.map((m) =>
            m.role === 'user' ? (
              <View key={m.id} style={styles.userBubble}>
                <Text style={styles.userText}>{m.text}</Text>
              </View>
            ) : (
              <View key={m.id} style={styles.botCard}>
                {m.research?.unavailable && (
                  <View style={styles.unverified}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.warn} />
                    <Text style={styles.unverifiedText}>Live research is unavailable, so this answer is not verified. Please check the official source.</Text>
                  </View>
                )}
                <RichText text={m.text} />

                {(m.destinationIds ?? []).map((id) => {
                  const d = DESTINATIONS.find((x) => x.id === id);
                  if (!d) return null;
                  return (
                    <View key={id} style={styles.destCard}>
                      <SafeImage uri={d.image} style={styles.destImg} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.destName}>{d.name}</Text>
                        <Text style={styles.destMeta}>{d.category} · {d.suggestedDays}</Text>
                        <View style={styles.destActions}>
                          <Pressable style={styles.pill} onPress={() => navigation.navigate('Details', { id })}>
                            <Text style={styles.pillText}>Open details</Text>
                          </Pressable>
                          <Pressable style={styles.pill} onPress={() => navigation.navigate('Plan', { destination: d.name })}>
                            <Text style={styles.pillText}>Plan trip</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {m.research?.used && (
                  <View style={styles.sources}>
                    <Text style={styles.sourcesTitle}>SOURCES · found with Google Search</Text>
                    {m.research.sources.length === 0 && <Text style={type.caption}>No source links were returned, so treat this as unverified.</Text>}
                    {m.research.sources.map((s) => (
                      <Pressable key={s.url} onPress={() => Linking.openURL(s.url)} style={styles.sourceRow} accessibilityLabel={`Open source ${s.title}`}>
                        <Ionicons name="link-outline" size={14} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sourceTitle} numberOfLines={1}>{s.title}</Text>
                          <Text style={type.caption} numberOfLines={1}>{new URL(s.url).hostname}</Text>
                        </View>
                      </Pressable>
                    ))}
                    <Text style={type.caption}>AI summaries can be wrong. Confirm important details on the official website.</Text>
                  </View>
                )}
              </View>
            ),
          )}

          {loading && (
            <View style={styles.botCard}>
              <View style={styles.typing}>
                <ActivityIndicator color={colors.primary} />
                <Text style={type.caption}>Thinking…</Text>
              </View>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="information-circle" size={18} color={colors.warn} />
              <View style={{ flex: 1 }}>
                <Text style={styles.error}>{error.message}</Text>
                {error.retryable && (
                  <Pressable onPress={retry} disabled={loading} style={styles.retryBtn} accessibilityRole="button">
                    <Ionicons name="refresh" size={14} color={colors.warn} />
                    <Text style={styles.retryText}>Try again</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {!loading && lastAssistant && lastAssistant === messages[messages.length - 1] && (lastAssistant.followUps ?? []).length > 0 && (
            <View style={styles.chipWrap}>
              {lastAssistant.followUps!.map((f) => (
                <Chip key={f} label={f} active={false} onPress={() => send(f)} />
              ))}
            </View>
          )}

          <View style={styles.tools}>
            <Chip label="🛂 Visa & entry help" active={showVisa} onPress={() => setShowVisa((v) => !v)} />
          </View>
          {showVisa && (
            <View style={styles.visaCard}>
              <Text style={styles.cardTitle}>Visa & entry help</Text>
              <Text style={type.caption}>I'll search for official information. Don't enter passport numbers or document details: I only need the basics below.</Text>
              <Field label="Passport nationality *" value={visa.nationality} onChange={(v) => setVisa({ ...visa, nationality: v })} placeholder="e.g. Indian" />
              <Field label="Country of residence" value={visa.residence} onChange={(v) => setVisa({ ...visa, residence: v })} placeholder="optional" />
              <Field label="Destination country *" value={visa.destination} onChange={(v) => setVisa({ ...visa, destination: v })} placeholder="e.g. Thailand" />
              <Text style={styles.fieldLabel}>Purpose</Text>
              <View style={styles.chipWrap}>
                {PURPOSES.map((p) => (
                  <Chip key={p} label={p} active={visa.purpose === p} onPress={() => setVisa({ ...visa, purpose: p })} />
                ))}
              </View>
              <Field label="Travel dates" value={visa.dates} onChange={(v) => setVisa({ ...visa, dates: v })} placeholder="optional, e.g. 12-20 Dec 2026" />
              <Field label="Length of stay" value={visa.stay} onChange={(v) => setVisa({ ...visa, stay: v })} placeholder="optional, e.g. 8 days" />
              {visaError !== '' && <Text style={styles.error}>{visaError}</Text>}
              <Pressable style={[styles.sendWide, loading && { opacity: 0.6 }]} onPress={sendVisa} disabled={loading}>
                <Ionicons name="search" size={16} color="#fff" />
                <Text style={styles.sendWideText}>Research official requirements</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about a trip…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            maxLength={600}
            accessibilityLabel="Message"
            onSubmitEditing={() => send(draft)}
          />
          <Pressable
            onPress={() => send(draft)}
            disabled={loading || !draft.trim()}
            style={[styles.sendBtn, (loading || !draft.trim()) && { opacity: 0.45 }]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} style={styles.fieldInput} maxLength={80} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 8 },
  brand: { color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 12 },
  title: type.title,
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  newText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  offline: { flexDirection: 'row', gap: 8, backgroundColor: colors.warnSoft, marginHorizontal: 20, marginTop: 10, borderRadius: 12, padding: 10 },
  offlineText: { color: colors.warn, flex: 1, fontSize: 13, fontWeight: '600' },
  contextPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.primarySoft, marginHorizontal: 20, marginTop: 10, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '90%' },
  contextText: { color: colors.primaryDark, fontWeight: '700', fontSize: 12, flexShrink: 1 },
  chat: { padding: 20, paddingBottom: 12, gap: 12 },
  welcome: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 6, ...shadow },
  welcomeTitle: { ...type.section, fontSize: 18 },
  sectionLabel: { color: colors.muted, fontWeight: '800', fontSize: 11, letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: colors.primary, borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  userText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  botCard: { alignSelf: 'stretch', backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, gap: 10, ...shadow },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unverified: { flexDirection: 'row', gap: 8, backgroundColor: colors.warnSoft, borderRadius: 10, padding: 10 },
  unverifiedText: { color: colors.warn, flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  destCard: { flexDirection: 'row', gap: 12, backgroundColor: colors.background, borderRadius: radius.md, padding: 10 },
  destImg: { width: 72, height: 72, borderRadius: 12 },
  destName: { fontWeight: '800', color: colors.text, fontSize: 16 },
  destMeta: { color: colors.muted, fontSize: 12, marginTop: 1 },
  destActions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  pill: { backgroundColor: colors.primarySoft, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  sources: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10, gap: 8 },
  sourcesTitle: { color: colors.muted, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  sourceRow: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.background, borderRadius: 10, padding: 10 },
  sourceTitle: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  errorBox: { flexDirection: 'row', gap: 8, backgroundColor: colors.warnSoft, borderRadius: 12, padding: 12 },
  error: { color: colors.warn, fontWeight: '600', lineHeight: 20 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.warn, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { color: colors.warn, fontWeight: '700', fontSize: 13 },
  tools: { flexDirection: 'row', marginTop: 4 },
  visaCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 8, ...shadow },
  cardTitle: { ...type.section },
  fieldLabel: { fontWeight: '700', color: colors.text, fontSize: 13, marginTop: 8, marginBottom: 4 },
  fieldInput: { height: 44, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 15, outlineStyle: 'none' } as any,
  sendWide: { marginTop: 10, backgroundColor: colors.accent, borderRadius: 14, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sendWideText: { color: '#fff', fontWeight: '800' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
  input: { flex: 1, maxHeight: 110, minHeight: 44, backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, color: colors.text, fontSize: 15, outlineStyle: 'none' } as any,
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
