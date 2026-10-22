/**
 * Home screen: lists destinations with a name search box and category filter chips.
 * Search and category are combined into a single filtered list.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { CATEGORIES, DESTINATIONS, Category } from '../data/destinations';
import DestinationCard from '../components/DestinationCard';

type Filter = Category | 'All';
const FILTERS: Filter[] = ['All', ...CATEGORIES];

export default function HomeScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Filter>('All');

  // Search (by name) and category filter are applied together.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DESTINATIONS.filter(
      (d) => (category === 'All' || d.category === category) && d.name.toLowerCase().includes(q),
    );
  }, [query, category]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={results}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Explore India</Text>
            <Text style={styles.subtitle}>Find your next getaway</Text>

            <View style={styles.search}>
              <Ionicons name="search" size={20} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search destinations"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCorrect={false}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.muted} />
                </Pressable>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              {FILTERS.map((f) => {
                const active = f === category;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setCategory(f)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="compass-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyText}>No destinations match your search.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <DestinationCard destination={item} onPress={() => navigation.navigate('Details', { id: item.id })} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: '900', color: colors.text },
  subtitle: { color: colors.muted, fontSize: 15, marginBottom: 16 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, fontSize: 16, color: colors.text, outlineStyle: 'none' } as any,
  chips: { marginVertical: 16, flexGrow: 0 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  empty: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: colors.muted, fontSize: 15 },
});
