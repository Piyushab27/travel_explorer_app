# Roam India: Travel Explorer

A React Native (Expo, TypeScript) app for discovering destinations across India, including lesser-known "hidden gems", planning a trip with a personalised matcher, and saving favourites to a wishlist. Built for the GDGC VNRVJIET App Development assignment.

## Tech stack

- React Native with Expo (TypeScript)
- React Navigation (bottom tabs + native stack)
- AsyncStorage for local persistence
- Open-Meteo (free, no API key) for live weather
- Static, local destination data (no backend)

## Features

**Assignment stages**

| Stage | Implemented |
|-------|-------------|
| 1. Discovery | 11 destinations across Beaches, Mountains, Heritage and Adventure (including wildlife). Each card shows image, name, location, category and a working wishlist heart |
| 2. Navigation & details | Tabs for Explore, Trip Match and Wishlist, plus a Details screen with hero image, description, best time to visit, 2–3 attractions with images and a nearby-experiences section |
| 3. Search & filtering | Case-insensitive name search, category chips and "All", all combined; clear-search, reset-filters and empty states |
| 4. Wishlist | Add and remove from cards or Details, no duplicates, live updates everywhere, empty state with an "Explore destinations" action, persisted across restarts |

**Extras**

- **Smart Trip Match:** pick preferred experience, budget, duration, travel style and interests to get ranked suggestions with reasons (see below).
- **Hidden gems:** five lesser-known places (Orchha, Mandu, Tirthan Valley, Gokarna's Half Moon Beach, Ziro Valley) with a "Hidden gem" badge, a daily featured gem on Home, and a local tip.
- **Entry cost and official link:** shown for hidden gems, for Indian visitors.
- **Customisable browsing:** toggles for Hidden gems, Free entry and Cheapest first.
- **Nearby experiences:** food, cafés, markets, shopping, nature, adventure and wellness, described as kinds of places or well-known areas (no invented businesses).
- **Google Maps links:** open the destination, each attraction, or a "cafés in …" style search, with no API key.
- **Live weather** with loading and unavailable states.
- **My notes:** write your own plans per destination, saved on the device.
- **Image fallbacks:** a broken image URL shows a placeholder instead of breaking the layout.

## Smart Trip Match: how it works

It is a deterministic, rule-based scoring engine in [`src/utils/matcher.ts`](src/utils/matcher.ts). It is **not** connected to a live AI model.

Each destination has metadata in [`src/data/guide.ts`](src/data/guide.ts) (theme, budget bands, suggested duration, travel styles, experiences, planning tip). For the user's choices a destination earns:

| Preference | Points |
|------------|--------|
| Preferred experience matches the destination's theme | +4 |
| Budget band matches | +2 |
| Duration matches (+1 if one band away) | +2 |
| Travel style matches | +2 |
| Each chosen interest the destination offers | +1 |

Only destinations that fit the chosen experience are listed, sorted by score. Each result explains why it matched and shows suggested days, attractions and a planning tip. Changing preferences changes the results. The preferred experience is required; the rest are optional. Preferences are validated when loaded from storage.

To add real AI later, replace `matchDestinations` with a call to a server-side endpoint that returns the same `Match[]` shape.

## Setup

Requires Node.js.

```bash
npm install
npx expo start        # press w (web), i (iOS simulator), a (Android), or scan the QR code with Expo Go
```

Note: Expo Go on your phone must support this project's Expo SDK version (58). If it says the project is incompatible, update Expo Go or run the web version with `npx expo start --web`.

## Project structure

```
src/
  data/destinations.ts      destination data and types
  data/guide.ts             trip-planning metadata (budget, experiences, tips)
  utils/matcher.ts          Smart Trip Match scoring engine
  context/WishlistContext   wishlist + notes state, persisted to AsyncStorage
  navigation/AppNavigator   tabs + stack
  screens/                  Home, Details, Wishlist, TripMatch
  components/               DestinationCard, HeartButton, SafeImage
  theme/                    colours and radii
```

## Screenshots

| Explore | Details | Trip Match | Wishlist |
|---------|---------|------------|----------|
| <img src="screenshots/home.jpg" width="200" /> | <img src="screenshots/details.jpg" width="200" /> | <img src="screenshots/trip-match.jpg" width="200" /> | <img src="screenshots/wishlist.jpg" width="200" /> |

## Limitations

- **Ticket prices** for hidden gems come from travel-guide websites, not official sources, and may be out of date or differ between sources. Always confirm on the linked official site. Popular destinations have no price shown.
- **Ziro Valley:** the Inner Line Permit fee could not be confirmed, so no price is shown.
- **Weather** needs an internet connection and shows "Unavailable" if the request fails. It is never made up.
- **Images** are loaded from Wikimedia Commons and need an internet connection.
- **Budget, duration and travel-style tags** are general guidance, not exact costs.
- Tested on the web build of the app; not run on a physical device or emulator.
