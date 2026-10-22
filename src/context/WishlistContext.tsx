/**
 * Wishlist state shared across all screens, saved to AsyncStorage so it survives restarts.
 * Only destination IDs are stored; screens look up the full data in DESTINATIONS.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'wishlist:v1';

interface WishlistValue {
  /** IDs of saved destinations. */
  ids: string[];
  isSaved: (id: string) => boolean;
  toggle: (id: string) => void;
}

const WishlistContext = createContext<WishlistValue | null>(null);

/** Holds wishlist state app-wide and persists it to local storage. */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Restore saved items on launch.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setIds(JSON.parse(raw)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Save on every change (but only after the initial load, so we never overwrite with []).
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)).catch(() => {});
  }, [ids, loaded]);

  const toggle = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const value = useMemo(
    () => ({ ids, toggle, isSaved: (id: string) => ids.includes(id) }),
    [ids, toggle],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
