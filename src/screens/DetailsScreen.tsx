/**
 * Details screen: shows one destination's description, best time to visit,
 * live weather (Open-Meteo), popular attractions and a Google Maps link.
 */
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';
import { DESTINATIONS } from '../data/destinations';
import HeartButton from '../components/HeartButton';
import SafeImage from '../components/SafeImage';
import { Interest } from '../data/guide';
import { useWishlist } from '../context/WishlistContext';

interface Weather {
  temp: number;
  label: string;
}

type WeatherState = 'loading' | 'error' | Weather;

const EXPERIENCE_META: Record<Interest, { title: string; icon: string }> = {
  food: { title: 'Food', icon: 'restaurant-outline' },
  cafes: { title: 'Cafés', icon: 'cafe-outline' },
  markets: { title: 'Markets', icon: 'storefront-outline' },
  shopping: { title: 'Shopping', icon: 'bag-handle-outline' },
  nature: { title: 'Nature & wildlife', icon: 'leaf-outline' },
  adventure: { title: 'Adventure', icon: 'trail-sign-outline' },
  wellness: { title: 'Wellness', icon: 'flower-outline' },
};

/** Maps Open-Meteo WMO weather codes to a short readable label. */
function describe(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Rain showers';
  return 'Thunderstorm';
}

export default function DetailsScreen({ route, navigation }: any) {
  const dest = DESTINATIONS.find((d) => d.id === route.params.id)!;
  const insets = useSafeAreaInsets();
  const [weather, setWeather] = useState<WeatherState>('loading');
  const { notes, setNote } = useWishlist();

  // Live weather from the free Open-Meteo API (no key needed). Fails silently if offline.
  useEffect(() => {
    const { lat, lon } = dest.coords;
    setWeather('loading');
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`)
      .then((r) => {
        if (!r.ok) throw new Error('weather request failed');
        return r.json();
      })
      .then((j) => setWeather({ temp: Math.round(j.current.temperature_2m), label: describe(j.current.weather_code) }))
      .catch(() => setWeather('error'));
  }, [dest]);

  // Google Maps search links need no API key.
  const openSearch = (query: string) =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  const openMaps = () =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${dest.coords.lat},${dest.coords.lon}`);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SafeImage uri={dest.image} style={styles.hero} />
        <View style={styles.body}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{dest.category}</Text>
          </View>
          <Text style={styles.name}>{dest.name}</Text>
          <View style={styles.row}>
            <Ionicons name="location-sharp" size={16} color={colors.muted} />
            <Text style={styles.location}>{dest.location}</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoBox}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text style={styles.infoLabel}>Best time</Text>
              <Text style={styles.infoValue}>{dest.bestTime}</Text>
            </View>
            <View style={styles.infoBox}>
              <Ionicons name="partly-sunny-outline" size={20} color={colors.accent} />
              <Text style={styles.infoLabel}>Weather now</Text>
              <Text style={styles.infoValue}>{weather === 'loading' ? 'Loading…' : weather === 'error' ? 'Unavailable' : `${weather.temp}°C, ${weather.label}`}</Text>
            </View>
          </View>

          {dest.hiddenGem && (
            <View style={styles.gemBanner}>
              <Text style={styles.gemText}>💎 Hidden gem: far fewer tourists than the famous spots</Text>
            </View>
          )}

          {dest.ticket && (
            <View style={styles.ticketBox}>
              <View style={styles.ticketHead}>
                <Ionicons name="ticket-outline" size={20} color={colors.primary} />
                <Text style={styles.ticketTitle}>Entry cost</Text>
                <Text style={styles.ticketPrice}>{dest.ticket.label}</Text>
              </View>
              <Text style={styles.ticketNote}>{dest.ticket.note}</Text>
              <Text style={styles.disclaimer}>Prices come from travel guides and may change. Confirm on the official site.</Text>
              {dest.website && (
                <Pressable style={styles.linkBtn} onPress={() => Linking.openURL(dest.website!)}>
                  <Ionicons name="open-outline" size={16} color={colors.primary} />
                  <Text style={styles.linkText}>Official website</Text>
                </Pressable>
              )}
            </View>
          )}

          <Text style={styles.section}>About</Text>
          <Text style={styles.desc}>{dest.description}</Text>

          <Text style={styles.section}>Popular attractions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {dest.attractions.map((a) => (
              <Pressable
                key={a.name}
                style={styles.attraction}
                onPress={() => openSearch(`${a.name}, ${dest.name}`)}
                accessibilityLabel={`${a.name}, open in Google Maps`}
              >
                <SafeImage uri={a.image} style={styles.attrImg} />
                <Text style={styles.attrName} numberOfLines={2}>
                  {a.name}
                </Text>
                <Text style={styles.attrMap}>View on Maps</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.section}>Nearby experiences</Text>
          {dest.experiences.map((e) => (
            <View key={e.text} style={styles.expRow}>
              <Ionicons name={EXPERIENCE_META[e.type].icon as any} size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.expTitle}>{EXPERIENCE_META[e.type].title}</Text>
                <Text style={styles.expText}>{e.text}</Text>
                <Pressable onPress={() => openSearch(`${EXPERIENCE_META[e.type].title} in ${dest.name}`)}>
                  <Text style={styles.attrMap}>Search on Maps</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Text style={styles.section}>Planning tip</Text>
          <Text style={styles.desc}>
            Suggested stay: {dest.suggestedDays}. {dest.planningTip}
          </Text>

          {dest.tip && (
            <>
              <Text style={styles.section}>Local tip</Text>
              <Text style={styles.desc}>{dest.tip}</Text>
            </>
          )}

          <Text style={styles.section}>My notes</Text>
          <TextInput
            value={notes[dest.id] ?? ''}
            onChangeText={(t) => setNote(dest.id, t)}
            placeholder="Add your own plans, budget or reminders (saved on this device)"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.notes}
          />

          <Pressable style={styles.mapBtn} onPress={openMaps}>
            <Ionicons name="map-outline" size={20} color="#fff" />
            <Text style={styles.mapText}>View on Google Maps</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <HeartButton id={dest.id} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { width: '100%', height: 300, backgroundColor: colors.border },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    marginTop: -28,
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 8,
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  name: { fontSize: 30, fontWeight: '900', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  location: { color: colors.muted, fontSize: 15 },
  infoRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  infoBox: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 4 },
  infoLabel: { color: colors.muted, fontSize: 12 },
  infoValue: { color: colors.text, fontWeight: '700', fontSize: 14 },
  section: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 24, marginBottom: 10 },
  desc: { color: colors.text, fontSize: 15, lineHeight: 23 },
  attraction: { width: 150, marginRight: 14 },
  attrImg: { width: 150, height: 110, borderRadius: radius.md, backgroundColor: colors.border },
  attrName: { marginTop: 6, fontWeight: '600', color: colors.text },
  gemBanner: { marginTop: 18, backgroundColor: '#FFF1EC', borderRadius: radius.md, padding: 12 },
  gemText: { color: colors.accent, fontWeight: '700' },
  ticketBox: { marginTop: 14, backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 6 },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketTitle: { flex: 1, fontWeight: '800', color: colors.text, fontSize: 16 },
  ticketPrice: { fontWeight: '900', color: colors.primaryDark, fontSize: 18 },
  ticketNote: { color: colors.text, lineHeight: 20 },
  disclaimer: { color: colors.muted, fontSize: 12 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  linkText: { color: colors.primary, fontWeight: '700' },
  notes: {
    minHeight: 80,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.text,
    textAlignVertical: 'top',
    outlineStyle: 'none',
  } as any,
  attrMap: { color: colors.primary, fontWeight: '600', fontSize: 12, marginTop: 2 },
  expRow: { flexDirection: 'row', gap: 12, marginBottom: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 12 },
  expTitle: { fontWeight: '800', color: colors.text },
  expText: { color: colors.text, lineHeight: 20, marginTop: 2 },
  mapBtn: {
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
