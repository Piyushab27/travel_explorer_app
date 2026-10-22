/**
 * App entry point.
 * Wraps the app in the safe-area and wishlist providers, then renders the navigator.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WishlistProvider } from './src/context/WishlistContext';
import { TripProvider } from './src/context/TripContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <WishlistProvider>
        <TripProvider>
        {/* On wide screens (web) keep the app phone-width and centred. */}
        <View style={styles.outer}>
          <View style={styles.inner}>
            <AppNavigator />
          </View>
        </View>
        </TripProvider>
        <StatusBar style="dark" />
      </WishlistProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center', backgroundColor: '#E9EEF0' },
  inner: { flex: 1, width: '100%', maxWidth: 560 },
});
