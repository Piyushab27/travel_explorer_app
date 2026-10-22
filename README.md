# Travel Explorer

A React Native (Expo, TypeScript) app for discovering destinations across India and saving favourites to a wishlist. Built for the GDGC VNRVJIET App Development assignment.

## Features

| Stage | What's implemented |
|-------|--------------------|
| 1. Discovery | 5 destinations across Beaches, Mountains, Heritage and Adventure, each with image, name, location and category |
| 2. Navigation & details | Bottom tabs (Home / Wishlist) plus a Details screen with description, best time to visit and 2–3 attractions with images |
| 3. Search & filter | Search by name combined with category chips |
| 4. Wishlist | Add and remove from cards or the details page, with a separate Wishlist screen and a tab badge |

**Extras:** wishlist persists across restarts (AsyncStorage), live weather (Open-Meteo, no API key), and a "View on Google Maps" link.

## Setup

```bash
npm install
npx expo start      # press i (iOS), a (Android) or w (web), or scan the QR with Expo Go
```

## Structure

```
src/
  data/destinations.ts      static destination data
  context/WishlistContext   wishlist state + persistence
  navigation/AppNavigator   tabs + stack
  screens/                  Home, Details, Wishlist
  components/               DestinationCard, HeartButton
  theme/                    colours and radii
```

## Screenshots

Add screenshots of Home, Details and Wishlist here before submitting.
