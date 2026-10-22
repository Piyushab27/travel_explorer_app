/**
 * Type-or-select destination field: the user can type any place, and matching
 * suggestions (the app's destinations plus other popular Indian places) appear below.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { DESTINATIONS } from '../data/destinations';

/** Popular places beyond the app's own list. The AI planner can handle any of them. */
const MORE_PLACES = [
  'Udaipur', 'Varanasi', 'Leh-Ladakh', 'Spiti Valley', 'Darjeeling', 'Pondicherry', 'Coorg',
  'Kerala Backwaters', 'Jaisalmer', 'Amritsar', 'Khajuraho', 'Mysuru', 'Gangtok', 'Shimla',
  'Kutch', 'Kochi', 'Lakshadweep', 'Sundarbans', 'Hyderabad', 'Kolkata',
];

const ALL_PLACES = Array.from(new Set([...DESTINATIONS.map((d) => d.name), ...MORE_PLACES]));

export default function DestinationInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q ? ALL_PLACES.filter((p) => p.toLowerCase().includes(q)) : ALL_PLACES;
    // Hide the list once the text exactly matches one entry.
    return list.length === 1 && list[0].toLowerCase() === q ? [] : list.slice(0, 7);
  }, [value]);

  return (
    <View>
      <View style={styles.inputRow}>
        <Ionicons name="location-outline" size={20} color={colors.muted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Type any place in India, or pick one"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCorrect={false}
          accessibilityLabel="Destination"
        />
        <Pressable onPress={() => setFocused((f) => !f)} hitSlop={8} accessibilityLabel="Show suggestions">
          <Ionicons name={focused ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
        </Pressable>
      </View>
      {focused && suggestions.length > 0 && (
        <View style={styles.list}>
          {suggestions.map((p) => (
            <Pressable
              key={p}
              style={styles.item}
              onPress={() => {
                onChange(p);
                setFocused(false);
              }}
            >
              <Text style={styles.itemText}>{p}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 50,
  },
  input: { flex: 1, fontSize: 16, color: colors.text, outlineStyle: 'none' } as any,
  list: {
    marginTop: 6,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  item: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemText: { color: colors.text, fontSize: 15 },
});
