/**
 * Image that never breaks the layout: while it loads or if the URL fails,
 * a neutral placeholder with an icon is shown instead.
 */
import React, { useState } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export default function SafeImage({ uri, style }: { uri: string; style: StyleProp<ImageStyle> }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View style={[style as any, styles.fallback]}>
        <Ionicons name="image-outline" size={32} color={colors.muted} />
      </View>
    );
  }
  return <Image source={{ uri }} style={[style, styles.base]} onError={() => setFailed(true)} />;
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.border },
  fallback: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
