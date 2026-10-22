/**
 * Trip-planning metadata for each destination, used by the Smart Trip Match
 * and the "Nearby experiences" section on the Details screen.
 *
 * Notes on accuracy:
 *  - Budget and duration are broad, qualitative bands (not prices).
 *  - Experiences only name well-known areas or kinds of places, never specific businesses.
 */

export type Theme = 'beaches' | 'mountains' | 'heritage' | 'adventure' | 'wildlife';
export type Budget = 'budget' | 'comfortable' | 'premium';
export type Duration = 'short' | 'week' | 'extended';
export type TravelStyle = 'solo' | 'family' | 'couple' | 'friends';
export type Interest = 'food' | 'cafes' | 'markets' | 'nature' | 'wellness' | 'shopping' | 'adventure';

export interface Experience {
  type: Interest;
  text: string;
}

export interface Guide {
  /** Main reason people visit: used to match the "preferred experience". */
  theme: Theme;
  /** Budget bands the destination suits (qualitative, not prices). */
  budgets: Budget[];
  /** Suggested trip length band and a human-readable version. */
  duration: Duration;
  suggestedDays: string;
  styles: TravelStyle[];
  experiences: Experience[];
  /** One practical planning tip. */
  planningTip: string;
}

export const GUIDE: Record<string, Guide> = {
  goa: {
    theme: 'beaches', budgets: ['budget', 'comfortable', 'premium'], duration: 'week', suggestedDays: '4–6 days',
    styles: ['friends', 'couple', 'family', 'solo'],
    experiences: [
      { type: 'food', text: 'Goan seafood and fish-curry-rice at beach shacks and local eateries.' },
      { type: 'cafes', text: 'Beachside cafés in North Goa and heritage-lane cafés around Panjim.' },
      { type: 'markets', text: 'Weekly flea and local markets such as the ones at Anjuna and Mapusa.' },
      { type: 'adventure', text: 'Water sports on the busier North Goa beaches.' },
      { type: 'wellness', text: 'Beach yoga and Ayurvedic massage centres.' },
    ],
    planningTip: 'Stay in North Goa for nightlife and in South Goa for quieter beaches.',
  },
  manali: {
    theme: 'mountains', budgets: ['budget', 'comfortable'], duration: 'week', suggestedDays: '4–6 days',
    styles: ['friends', 'couple', 'family', 'solo'],
    experiences: [
      { type: 'food', text: 'Himachali dhaam meals and fresh river trout.' },
      { type: 'cafes', text: 'Relaxed cafés in the Old Manali area.' },
      { type: 'markets', text: 'Mall Road for woollens, shawls and handicrafts.' },
      { type: 'adventure', text: 'Paragliding and snow activities around Solang Valley (season dependent).' },
      { type: 'nature', text: 'Pine forests, the Beas river and mountain viewpoints.' },
      { type: 'wellness', text: 'Hot-spring baths near Vashisht village.' },
    ],
    planningTip: 'Check whether Rohtang Pass is open and whether a permit is needed before you plan the day.',
  },
  jaipur: {
    theme: 'heritage', budgets: ['comfortable', 'premium'], duration: 'short', suggestedDays: '2–3 days',
    styles: ['family', 'couple', 'friends', 'solo'],
    experiences: [
      { type: 'food', text: 'Rajasthani thali, dal-baati-churma and street snacks.' },
      { type: 'cafes', text: 'Rooftop cafés with views of the old city.' },
      { type: 'markets', text: 'Johari Bazaar for jewellery and Bapu Bazaar for textiles and mojris.' },
      { type: 'shopping', text: 'Blue pottery, block-printed fabrics and handicrafts.' },
      { type: 'wellness', text: 'Ayurvedic spas in heritage hotels.' },
    ],
    planningTip: 'Start forts early in the morning to avoid the midday heat and crowds.',
  },
  agra: {
    theme: 'heritage', budgets: ['budget', 'comfortable'], duration: 'short', suggestedDays: '1–2 days',
    styles: ['family', 'couple', 'solo', 'friends'],
    experiences: [
      { type: 'food', text: 'Mughlai dishes and the city’s famous petha sweets.' },
      { type: 'markets', text: 'Old-city bazaars such as Kinari Bazaar and Sadar Bazaar.' },
      { type: 'shopping', text: 'Marble inlay work, leather goods and handicrafts.' },
      { type: 'nature', text: 'Sunset views of the Taj from the Yamuna riverbank gardens.' },
    ],
    planningTip: 'Visit the Taj Mahal at sunrise and check which day of the week it is closed.',
  },
  rishikesh: {
    theme: 'adventure', budgets: ['budget', 'comfortable'], duration: 'week', suggestedDays: '3–5 days',
    styles: ['friends', 'solo', 'couple', 'family'],
    experiences: [
      { type: 'adventure', text: 'White-water rafting, bungee jumping and trekking (season dependent).' },
      { type: 'wellness', text: 'Yoga ashrams, meditation classes and the evening Ganga aarti.' },
      { type: 'cafes', text: 'Riverside cafés around the Laxman Jhula and Ram Jhula areas.' },
      { type: 'food', text: 'Mostly vegetarian food and simple ashram-style meals.' },
      { type: 'markets', text: 'Lanes near the bridges for books, handicrafts and spiritual items.' },
    ],
    planningTip: 'Rafting is usually paused in the monsoon, so check operator availability for your dates.',
  },
  orchha: {
    theme: 'heritage', budgets: ['budget', 'comfortable'], duration: 'short', suggestedDays: '2 days',
    styles: ['couple', 'solo', 'family', 'friends'],
    experiences: [
      { type: 'food', text: 'Local Madhya Pradesh breakfasts and simple riverside eateries.' },
      { type: 'cafes', text: 'Small cafés with fort views near the main square.' },
      { type: 'nature', text: 'Quiet walks along the Betwa river and its ghats.' },
      { type: 'shopping', text: 'Handicraft stalls around the Ram Raja Temple area.' },
      { type: 'adventure', text: 'River activities on the Betwa when operators run them (seasonal).' },
    ],
    planningTip: 'Stay overnight rather than doing a day trip, so you can see the fort in the evening.',
  },
  mandu: {
    theme: 'heritage', budgets: ['budget'], duration: 'short', suggestedDays: '1–2 days',
    styles: ['couple', 'solo', 'friends', 'family'],
    experiences: [
      { type: 'nature', text: 'Sunset viewpoints and monsoon greenery on the plateau.' },
      { type: 'food', text: 'Simple Malwa-region meals at local eateries.' },
      { type: 'adventure', text: 'Cycling between the monument groups.' },
    ],
    planningTip: 'The monuments are spread out, so plan transport for the day in advance.',
  },
  tirthan: {
    theme: 'mountains', budgets: ['comfortable'], duration: 'week', suggestedDays: '3–5 days',
    styles: ['solo', 'couple', 'friends', 'family'],
    experiences: [
      { type: 'nature', text: 'Forest trails and river walks at the edge of the Great Himalayan National Park.' },
      { type: 'adventure', text: 'Day treks and permitted trout fishing.' },
      { type: 'food', text: 'Home-cooked Himachali meals and trout at homestays.' },
      { type: 'wellness', text: 'Slow, quiet riverside stays for rest and unwinding.' },
      { type: 'cafes', text: 'A few small riverside cafés around Gushaini.' },
    ],
    planningTip: 'Book a homestay in advance and ask your host about guided treks and permits.',
  },
  gokarna: {
    theme: 'beaches', budgets: ['budget', 'comfortable'], duration: 'short', suggestedDays: '3–4 days',
    styles: ['friends', 'solo', 'couple'],
    experiences: [
      { type: 'food', text: 'Fresh seafood and South Indian meals at beach shacks.' },
      { type: 'cafes', text: 'Laid-back shack cafés at Om and Kudle beaches.' },
      { type: 'nature', text: 'Cliff-top trails connecting the beaches.' },
      { type: 'wellness', text: 'Yoga and meditation near the beaches.' },
      { type: 'markets', text: 'The temple town’s main street for souvenirs and offerings.' },
    ],
    planningTip: 'Carry cash and water on beach treks, because shops and ATMs are limited.',
  },
  ziro: {
    theme: 'adventure', budgets: ['comfortable'], duration: 'extended', suggestedDays: '5–8 days',
    styles: ['solo', 'friends', 'couple'],
    experiences: [
      { type: 'nature', text: 'Rice fields, pine hills and forest walks around the plateau.' },
      { type: 'adventure', text: 'Cycling and trekking through villages.' },
      { type: 'food', text: 'Apatani home cooking and bamboo-shoot dishes.' },
      { type: 'shopping', text: 'Local handloom and bamboo crafts.' },
    ],
    planningTip: 'Apply for your Inner Line Permit before travelling and allow extra days for the long journey.',
  },
  kaziranga: {
    theme: 'wildlife', budgets: ['comfortable', 'premium'], duration: 'week', suggestedDays: '2–4 days',
    styles: ['family', 'couple', 'friends', 'solo'],
    experiences: [
      { type: 'nature', text: 'Jeep and elephant safaris to spot rhinos, elephants and birds.' },
      { type: 'food', text: 'Assamese thali and fresh local fish.' },
      { type: 'shopping', text: 'Assam tea and handwoven silk from local shops.' },
      { type: 'adventure', text: 'Birdwatching walks and guided nature outings near the park.' },
    ],
    planningTip: 'Book safari slots early and carry neutral-coloured clothing for wildlife viewing.',
  },
};
