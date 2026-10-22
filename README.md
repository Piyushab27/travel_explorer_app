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
| 1. Discovery | 15 destinations across Beaches, Mountains, Heritage and Adventure (including wildlife). Each card shows image, name, location, category and a working wishlist heart |
| 2. Navigation & details | Tabs for Explore, Trip Match, Plan and Wishlist, plus a Details screen with hero image, description, best time to visit, 2–3 attractions with images and a nearby-experiences section |
| 3. Search & filtering | Case-insensitive name search, category chips and "All", all combined; clear-search, reset-filters and empty states |
| 4. Wishlist | Add and remove from cards or Details, no duplicates, live updates everywhere, empty state with an "Explore destinations" action, persisted across restarts |

**Extras**

- **AI Trip Planner:** type any place in India (or pick from a dropdown), choose days, month, budget, style and interests, and get a day-by-day itinerary written by a real Gemini model through a small server (see below). Plans can be saved on the device.
- **Smart Trip Match:** pick preferred experience, budget, duration, travel style and interests to get ranked suggestions with reasons (see below).
- **Hidden gems:** five lesser-known places (Orchha, Mandu, Tirthan Valley, Gokarna's Half Moon Beach, Ziro Valley) with a "Hidden gem" badge, a daily featured gem on Home, and a local tip.
- **Entry cost and official link:** shown for hidden gems, for Indian visitors.
- **Customisable browsing:** toggles for Hidden gems, Free entry and Cheapest first.
- **Nearby experiences:** food, cafés, markets, shopping, nature, adventure and wellness, described as kinds of places or well-known areas (no invented businesses).
- **Google Maps links:** open the destination, each attraction, or a "cafés in …" style search, with no API key.
- **Live weather** with loading and unavailable states.
- **My notes:** write your own plans per destination, saved on the device.
- **Image fallbacks:** a broken image URL shows a placeholder instead of breaking the layout.

## AI Trip Planner: how it works

The mobile app never holds an API key. Instead it calls [`server/index.js`](server/index.js), a tiny dependency-free Node server that holds `GEMINI_API_KEY` and calls the Google Gemini API (`generateContent`). The default model is `gemini-3.8-flash`; Google renames models often, so if you get a model error set `GEMINI_MODEL` to one listed on the [Gemini models page](https://ai.google.dev/gemini-api/docs/models). You can get a free key at [Google AI Studio](https://aistudio.google.com/apikey).

1. The app sends the request (destination, days, month, budget, style, interests, notes) plus facts from its own data (best time, attractions, entry notes) so the model stays grounded.
2. The server validates the input (days 1–14, lengths capped), asks the model for JSON (JSON mode), parses it, and normalises it before returning it.
3. The model is told never to invent businesses, prices, opening hours or distances, and to say "check locally" when unsure. Every plan ends with a reminder to verify timings, permits and prices.
4. If the server is unreachable or has no key, the planner shows a clearly labelled **"Offline plan (not AI)"** built from the app's own data, and only for places in the app. For other places it explains that the AI planner is needed.

The Plan screen shows whether the AI planner is connected.

```bash
# terminal 1: start the AI server (needs your own Gemini API key)
GEMINI_API_KEY=your-key npm run server

# terminal 2: start the app
npx expo start --web
```

On a physical phone `localhost` points at the phone, so set the server's address first, for example
`EXPO_PUBLIC_API_URL=http://<your-laptop-ip>:8787 npx expo start` (the Android emulator uses `http://10.0.2.2:8787`).

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
server/index.js            AI itinerary server (holds the API key)
src/
  services/itinerary.ts     calls the AI server, plus the offline fallback
  data/destinations.ts      destination data and types
  data/guide.ts             trip-planning metadata (budget, experiences, tips)
  utils/matcher.ts          Smart Trip Match scoring engine
  context/WishlistContext   wishlist + notes state, persisted to AsyncStorage
  navigation/AppNavigator   tabs + stack
  screens/                  Home, Details, Wishlist, TripMatch, Planner
  components/               DestinationCard, HeartButton, SafeImage, Chips, DestinationInput
  theme/                    colours and radii
```

## Screenshots

| Explore | Details | Trip Match | Wishlist |
|---------|---------|------------|----------|
| <img src="screenshots/home.jpg" width="200" /> | <img src="screenshots/details.jpg" width="200" /> | <img src="screenshots/trip-match.jpg" width="200" /> | <img src="screenshots/wishlist.jpg" width="200" /> |

Trip Planner showing the labelled offline fallback (the AI version needs your API key):

<img src="screenshots/planner.jpg" width="200" />

## Limitations

- **AI planner needs a server and your own API key.** Without them only the labelled offline plan is available. During development the server pipeline (request validation, auth headers, JSON parsing, the app screens) was tested against a mock Gemini endpoint (including blocked, empty and model-not-found replies); the real model's output quality was not tested because no API key was available. Check plans yourself, since language models can make mistakes.

- **Ticket prices** for hidden gems come from travel-guide websites, not official sources, and may be out of date or differ between sources. Always confirm on the linked official site. Popular destinations have no price shown.
- **Ziro Valley:** the Inner Line Permit fee could not be confirmed, so no price is shown.
- **Weather** needs an internet connection and shows "Unavailable" if the request fails. It is never made up.
- **Images** are loaded from Wikimedia Commons and need an internet connection.
- **Budget, duration and travel-style tags** are general guidance, not exact costs.
- Tested on the web build of the app; not run on a physical device or emulator.
