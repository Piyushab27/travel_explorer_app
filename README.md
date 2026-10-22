# Travel Explorer

A React Native (Expo, TypeScript) app for discovering destinations across India and saving favourites to a wishlist. Built for the GDGC VNRVJIET App Development assignment.

## Features

| Stage | What's implemented |
|-------|--------------------|
| 1. Discovery | 5 destinations across Beaches, Mountains, Heritage and Adventure, each with image, name, location and category |
| 2. Navigation & details | Bottom tabs (Home / Wishlist) plus a Details screen with description, best time to visit and 2–3 attractions with images |
| 3. Search & filter | Search by name combined with category chips |
| 4. Wishlist | Add and remove from cards or the details page, with a separate Wishlist screen and a tab badge |

**Extras:**
- Wishlist persists across restarts (AsyncStorage).
- Live weather (Open-Meteo, no API key) and a "View on Google Maps" link.
- **Hidden gems:** five lesser-known places (Orchha, Mandu, Tirthan Valley, Gokarna's Half Moon Beach, Ziro Valley), researched from travel guides.
- **Entry cost and official website** on each hidden gem. Prices are for Indian visitors and come from travel guides, so they may be out of date. Always confirm on the linked official site.
- **Customisable browsing:** toggles for Hidden gems, Free entry and Cheapest first, combined with search and category filters.
- **My notes:** write your own plans or budget per destination, saved on the device.
- A local tip for each hidden gem.

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

| Home | Details | Wishlist |
|------|---------|----------|
| <img src="screenshots/home.jpg" width="240" /> | <img src="screenshots/details.jpg" width="240" /> | <img src="screenshots/wishlist.jpg" width="240" /> |
