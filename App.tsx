import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WishlistProvider } from './src/context/WishlistContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <WishlistProvider>
        <AppNavigator />
        <StatusBar style="dark" />
      </WishlistProvider>
    </SafeAreaProvider>
  );
}
