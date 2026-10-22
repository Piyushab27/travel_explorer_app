/**
 * The active trip, shared by every AI screen (Concierge, Planner, Budget, Trip Match, Details).
 * Holds what the traveller has told us (destination, days, budget...), the current itinerary and
 * the concierge conversation, so follow-up questions never lose context. Saved to the device;
 * only the fields needed for a request are ever sent to the AI server.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Activity, Itinerary, ItineraryRequest, ItinerarySource, findDestination, newId } from '../services/itinerary';
import { ChatReply, parseItinerary } from '../services/validate';
import { TripContext as AiTripContext } from '../services/ai';
import { DESTINATIONS } from '../data/destinations';

export interface Trip {
  destination: string;
  days: number | null;
  budgetInr: number | null;
  travelers: number | null;
  style: string;
  budgetLevel: string;
  interests: string[];
  month: string;
  startCity: string;
}

export const EMPTY_TRIP: Trip = { destination: '', days: null, budgetInr: null, travelers: null, style: '', budgetLevel: '', interests: [], month: '', startCity: '' };

export interface Plan {
  itinerary: Itinerary;
  source: ItinerarySource;
  request: ItineraryRequest;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  followUps?: string[];
  destinationIds?: string[];
  research?: ChatReply['research'];
}

const KEYS = { trip: 'trip:v2', plan: 'plan:v2', chat: 'chat:v2' };
const MAX_STORED_MESSAGES = 30;

interface Value {
  trip: Trip;
  updateTrip: (patch: Partial<Trip>) => void;
  plan: Plan | null;
  setPlan: (p: Plan | null) => void;
  /** Applies an edit to the current itinerary (remove/replace/add). Totals are derived, so they follow automatically. */
  editItinerary: (fn: (it: Itinerary) => Itinerary) => void;
  /** Adds an activity from a destination page. Returns why it could not be added, or null on success. */
  addActivity: (activity: Omit<Activity, 'id'>, destinationName: string) => 'no-plan' | 'other-destination' | null;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /** Compact context for the AI: only the fields that matter, never anything personal. */
  aiContext: () => AiTripContext;
  newConversation: () => void;
}

const Ctx = createContext<Value | null>(null);

const planSummary = (it: Itinerary) =>
  it.days.map((d) => `Day ${d.day} ${d.title}: ${d.activities.map((a) => `[${a.time}] ${a.text}`).join(' | ')}`).join('\n').slice(0, 2400);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [trip, setTrip] = useState<Trip>(EMPTY_TRIP);
  const [plan, setPlanState] = useState<Plan | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, p, c] = await Promise.all([AsyncStorage.getItem(KEYS.trip), AsyncStorage.getItem(KEYS.plan), AsyncStorage.getItem(KEYS.chat)]);
        if (t) setTrip({ ...EMPTY_TRIP, ...JSON.parse(t) });
        if (p) {
          const raw = JSON.parse(p);
          const itinerary = parseItinerary(raw?.itinerary);
          if (itinerary && raw.request) setPlanState({ itinerary, source: raw.source === 'offline' ? 'offline' : 'ai', request: raw.request });
        }
        if (c) {
          const list = JSON.parse(c);
          if (Array.isArray(list)) {
            setMessages(
              list
                .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
                .slice(-MAX_STORED_MESSAGES)
                .map((m: any) => ({ ...m, id: String(m.id || newId()) })),
            );
          }
        }
      } catch {
        // Corrupt or unavailable storage: start fresh.
      } finally {
        loaded.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEYS.trip, JSON.stringify(trip)).catch(() => {});
  }, [trip]);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEYS.plan, JSON.stringify(plan)).catch(() => {});
  }, [plan]);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEYS.chat, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES))).catch(() => {});
  }, [messages]);

  const updateTrip = useCallback((patch: Partial<Trip>) => setTrip((t) => ({ ...t, ...patch })), []);
  const setPlan = useCallback((p: Plan | null) => setPlanState(p), []);

  const editItinerary = useCallback((fn: (it: Itinerary) => Itinerary) => {
    setPlanState((p) => (p ? { ...p, itinerary: fn(p.itinerary) } : p));
  }, []);

  const addActivity = useCallback<Value['addActivity']>(
    (activity, destinationName) => {
      if (!plan || !plan.itinerary.days.length) return 'no-plan';
      const planDest = findDestination(plan.request.destination);
      const thisDest = findDestination(destinationName);
      const same = planDest && thisDest ? planDest.id === thisDest.id : plan.request.destination.toLowerCase().includes(destinationName.toLowerCase().split(' (')[0]);
      if (!same) return 'other-destination';
      setPlanState((p) => {
        if (!p) return p;
        // Put it on the day with the fewest activities so the trip stays balanced.
        const idx = p.itinerary.days.reduce((best, d, i, all) => (d.activities.length < all[best].activities.length ? i : best), 0);
        const days = p.itinerary.days.map((d, i) => (i === idx ? { ...d, activities: [...d.activities, { ...activity, id: newId() }] } : d));
        return { ...p, itinerary: { ...p.itinerary, days } };
      });
      return null;
    },
    [plan],
  );

  const aiContext = useCallback((): AiTripContext => {
    const dest = trip.destination ? findDestination(trip.destination) : undefined;
    return {
      destination: trip.destination || undefined,
      destinationId: dest?.id,
      days: trip.days,
      budgetInr: trip.budgetInr,
      travelers: trip.travelers,
      style: trip.style || undefined,
      budgetLevel: trip.budgetLevel || undefined,
      interests: trip.interests,
      month: trip.month || undefined,
      startCity: trip.startCity || undefined,
      itinerarySummary: plan ? planSummary(plan.itinerary) : undefined,
    };
  }, [trip, plan]);

  const newConversation = useCallback(() => setMessages([]), []);

  const value = useMemo(
    () => ({ trip, updateTrip, plan, setPlan, editItinerary, addActivity, messages, setMessages, aiContext, newConversation }),
    [trip, updateTrip, plan, setPlan, editItinerary, addActivity, messages, aiContext, newConversation],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrip() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTrip must be used inside TripProvider');
  return v;
}

export const ALLOWED_DESTINATIONS = DESTINATIONS.map((d) => ({ id: d.id, name: d.name }));
