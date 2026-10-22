/**
 * Wishlist screen: shows the destinations the user has saved.
 * Updates automatically because it reads from the shared WishlistContext.
 */
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { DESTINATIONS } from '../data/destinations';
import { useWishlist } from '../context/WishlistContext';
import DestinationCard from '../components/DestinationCard';

export default function WishlistScreen({ navigation }: any) {
  const { ids } = useWishlist();
  const saved = DESTINATIONS.filter((d) => ids.includes(d.id));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={saved}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.title}>Wishlist</Text>
            <Text style={styles.subtitle}>
              {saved.length} saved {saved.length === 1 ? 'place' : 'places'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={52} color={colors.muted} />
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyText}>Tap the heart on a destination to save it for later.</Text>
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
  subtitle: { color: colors.muted, fontSize: 15 },
  empty: { alignItems: 'center', marginTop: 70, gap: 8, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { color: colors.muted, textAlign: 'center' },
});
