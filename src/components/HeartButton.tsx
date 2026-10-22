import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useWishlist } from '../context/WishlistContext';

/** Round heart toggle that adds/removes a destination from the wishlist. */
export default function HeartButton({ id }: { id: string }) {
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(id);
  return (
    <Pressable
      onPress={() => toggle(id)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from wishlist' : 'Add to wishlist'}
      style={styles.btn}
    >
      <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? colors.heart : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
