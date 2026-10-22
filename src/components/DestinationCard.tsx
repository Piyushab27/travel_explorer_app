/**
 * Reusable destination card (image, category badge, heart, name, location).
 * Used by both the Home and Wishlist lists.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Destination } from '../data/destinations';
import HeartButton from './HeartButton';

interface Props {
  destination: Destination;
  onPress: () => void;
}

/** Large image card used on the Home and Wishlist lists. */
export default function DestinationCard({ destination, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Image source={{ uri: destination.image }} style={styles.image} />
      <View style={styles.heart}>
        <HeartButton id={destination.id} />
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{destination.category}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{destination.name}</Text>
        <View style={styles.row}>
          <Ionicons name="location-sharp" size={14} color={colors.muted} />
          <Text style={styles.location}>{destination.location}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: 18,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  image: { width: '100%', height: 190, backgroundColor: colors.border },
  heart: { position: 'absolute', top: 12, right: 12 },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  info: { padding: 14 },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 3 },
  location: { color: colors.muted, fontSize: 14 },
});
