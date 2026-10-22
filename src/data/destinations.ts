/**
 * Static destination data and types. No backend is used; every screen reads from here.
 * Trip-planning metadata (budget, experiences, tips) lives in guide.ts and is merged in below.
 */
import { Guide, GUIDE } from './guide';
export type Category = 'Beaches' | 'Mountains' | 'Heritage' | 'Adventure';

export const CATEGORIES: Category[] = ['Beaches', 'Mountains', 'Heritage', 'Adventure'];

export interface Attraction {
  name: string;
  image: string;
}

export interface BaseDestination {
  id: string;
  name: string;
  location: string;
  category: Category;
  image: string;
  description: string;
  bestTime: string;
  attractions: Attraction[];
  /** Used for the Google Maps link and the weather lookup. */
  coords: { lat: number; lon: number };
  /** Lesser-known places away from the usual tourist trail. */
  hiddenGem?: boolean;
  /** Entry cost for Indian visitors. Figures come from travel guides, so always confirm on the official site. */
  ticket?: Ticket;
  /** Official or authoritative page to verify prices and timings. */
  website?: string;
  /** Local-style advice shown on the Details screen. */
  tip?: string;
}

export interface Ticket {
  /** Short label such as "₹10" or "Free". */
  label: string;
  /** Numeric lower-bound price in rupees (0 = free). null when no fixed price is published. Used for sorting/filtering. */
  amount: number | null;
  /** Extra detail about what the price covers. */
  note: string;
}

const wiki = (path: string) => `https://upload.wikimedia.org/wikipedia/commons/${path}`;

/** Static destination data (no backend required). */
const BASE_DESTINATIONS: BaseDestination[] = [
  {
    id: 'goa',
    name: 'Goa',
    location: 'Goa, India',
    category: 'Beaches',
    image: wiki('thumb/f/fc/BeachFun.jpg/960px-BeachFun.jpg'),
    description:
      'India’s sun-soaked coastline, famous for golden beaches, Portuguese-era churches, fresh seafood and a relaxed vibe.',
    bestTime: 'November to February',
    coords: { lat: 15.2993, lon: 74.124 },
    attractions: [
      { name: 'Palolem Beach', image: wiki('thumb/9/9c/Palolem_Beach%2C_South_Goa.jpg/960px-Palolem_Beach%2C_South_Goa.jpg') },
      { name: 'Basilica of Bom Jesus', image: wiki('thumb/9/9e/Front_Elevation_of_Basilica_of_Bom_Jesus.jpg/960px-Front_Elevation_of_Basilica_of_Bom_Jesus.jpg') },
      { name: 'Fort Aguada', image: wiki('thumb/a/ad/Fort_aguada.jpg/960px-Fort_aguada.jpg') },
    ],
  },
  {
    id: 'manali',
    name: 'Manali',
    location: 'Himachal Pradesh, India',
    category: 'Mountains',
    image: wiki('thumb/0/03/Manali_City.jpg/960px-Manali_City.jpg'),
    description:
      'A Himalayan hill town wrapped in pine forests and snow peaks, perfect for cool escapes and mountain views.',
    bestTime: 'March to June, December for snow',
    coords: { lat: 32.2432, lon: 77.1892 },
    attractions: [
      { name: 'Solang Valley', image: wiki('thumb/f/f1/Solang_Valley_%2CManali%2C_Himachal_Pardes%2C_India.JPG/960px-Solang_Valley_%2CManali%2C_Himachal_Pardes%2C_India.JPG') },
      { name: 'Rohtang Pass', image: wiki('thumb/a/a2/Kullu_Valley_from_Rohtang_Pass%2C_India.jpg/960px-Kullu_Valley_from_Rohtang_Pass%2C_India.jpg') },
    ],
  },
  {
    id: 'jaipur',
    name: 'Jaipur',
    location: 'Rajasthan, India',
    category: 'Heritage',
    image: wiki('thumb/4/41/East_facade_Hawa_Mahal_Jaipur_from_ground_level_%28July_2022%29_-_img_01.jpg/960px-East_facade_Hawa_Mahal_Jaipur_from_ground_level_%28July_2022%29_-_img_01.jpg'),
    description:
      'The Pink City, a royal showcase of forts, palaces and bustling bazaars rich with Rajput history.',
    bestTime: 'October to March',
    coords: { lat: 26.9124, lon: 75.7873 },
    attractions: [
      { name: 'Hawa Mahal', image: wiki('thumb/4/41/East_facade_Hawa_Mahal_Jaipur_from_ground_level_%28July_2022%29_-_img_01.jpg/960px-East_facade_Hawa_Mahal_Jaipur_from_ground_level_%28July_2022%29_-_img_01.jpg') },
      { name: 'Amber Fort', image: wiki('thumb/f/fb/20191219_Fort_Amber%2C_Amer%2C_Jaipur_0955_9481.jpg/960px-20191219_Fort_Amber%2C_Amer%2C_Jaipur_0955_9481.jpg') },
      { name: 'City Palace', image: wiki('thumb/a/a4/Chandra_Mahal%2C_City_Palace%2C_Jaipur%2C_20191218_0951_9043.jpg/960px-Chandra_Mahal%2C_City_Palace%2C_Jaipur%2C_20191218_0951_9043.jpg') },
    ],
  },
  {
    id: 'agra',
    name: 'Agra',
    location: 'Uttar Pradesh, India',
    category: 'Heritage',
    image: wiki('thumb/1/1d/Taj_Mahal_%28Edited%29.jpeg/960px-Taj_Mahal_%28Edited%29.jpeg'),
    description:
      'Home of the Taj Mahal, the monument of love, and a treasure of Mughal architecture on the Yamuna river.',
    bestTime: 'October to March',
    coords: { lat: 27.1767, lon: 78.0081 },
    attractions: [
      { name: 'Taj Mahal', image: wiki('thumb/1/1d/Taj_Mahal_%28Edited%29.jpeg/960px-Taj_Mahal_%28Edited%29.jpeg') },
      { name: 'Agra Fort', image: wiki('thumb/8/8d/Agra_03-2016_16_Agra_Fort.jpg/960px-Agra_03-2016_16_Agra_Fort.jpg') },
      { name: 'Mehtab Bagh', image: wiki('thumb/8/8d/Mehtab_Bagh_facing_Taj_Mahal.JPG/960px-Mehtab_Bagh_facing_Taj_Mahal.JPG') },
    ],
  },
  {
    id: 'rishikesh',
    name: 'Rishikesh',
    location: 'Uttarakhand, India',
    category: 'Adventure',
    image: wiki('1/11/Ramjhula_-_bridge_over_the_Ganga.jpg'),
    description:
      'The adventure capital of India: white-water rafting, bungee jumping and trekking beside the sacred Ganges.',
    bestTime: 'September to November, February to May',
    coords: { lat: 30.0869, lon: 78.2676 },
    attractions: [
      { name: 'Ram Jhula', image: wiki('1/11/Ramjhula_-_bridge_over_the_Ganga.jpg') },
      { name: 'Triveni Ghat', image: wiki('0/08/Triveni_Ghat_Krishna_Arjun_Rath.jpg') },
    ],
  },

  // ---------------- Hidden gems: off the usual tourist trail ----------------
  {
    id: 'orchha',
    name: 'Orchha',
    location: 'Madhya Pradesh, India',
    category: 'Heritage',
    hiddenGem: true,
    image: wiki('thumb/8/8c/Jahangir_Mahal%2C_Orchha%2C_Madhya_Pradesh%2C_India.jpg/960px-Jahangir_Mahal%2C_Orchha%2C_Madhya_Pradesh%2C_India.jpg'),
    description:
      'A quiet riverside town of Bundela palaces, temples and royal cenotaphs on the Betwa river, with a fraction of the crowds of Agra or Jaipur.',
    bestTime: 'October to March',
    coords: { lat: 25.3519, lon: 78.6406 },
    ticket: {
      label: '₹10',
      amount: 10,
      note: 'Combined fort-complex ticket for Indians (₹250 for foreigners, plus ₹25 per camera). Valid only on the day of purchase.',
    },
    website: 'https://www.mptourism.com',
    tip: 'Stay for the evening: the fort’s light and sound show (about ₹200 for Indians) is the best way to see it after the day-trippers leave.',
    attractions: [
      { name: 'Jahangir Mahal', image: wiki('thumb/8/8c/Jahangir_Mahal%2C_Orchha%2C_Madhya_Pradesh%2C_India.jpg/960px-Jahangir_Mahal%2C_Orchha%2C_Madhya_Pradesh%2C_India.jpg') },
      { name: 'Raja Mahal', image: wiki('thumb/e/eb/Raja_Mahal%2C_Orchha.jpg/960px-Raja_Mahal%2C_Orchha.jpg') },
      { name: 'Royal Chhatris', image: wiki('thumb/3/3f/Chhatris%28Cenotaphs%29%2C_Orchha_05.jpg/960px-Chhatris%28Cenotaphs%29%2C_Orchha_05.jpg') },
    ],
  },
  {
    id: 'mandu',
    name: 'Mandu',
    location: 'Madhya Pradesh, India',
    category: 'Heritage',
    hiddenGem: true,
    image: wiki('thumb/b/ba/Jahaz_Mahal_on_the_bank_of_Hauz-i-Shamsi.jpg/960px-Jahaz_Mahal_on_the_bank_of_Hauz-i-Shamsi.jpg'),
    description:
      'A ruined hilltop fortress-city of Afghan-era palaces and mosques, famous for the “Ship Palace” between two lakes and a marble tomb said to have inspired the Taj Mahal.',
    bestTime: 'July to September (monsoon greenery) or October to March',
    coords: { lat: 22.3612, lon: 75.3976 },
    ticket: {
      label: '₹25',
      amount: 25,
      note: 'ASI ticket for the Royal Enclave group for Indians (₹300 for foreigners). One older guide lists ₹15, so confirm at the counter.',
    },
    website: 'https://asi.nic.in',
    tip: 'Monuments are spread over a large plateau. Hire a bicycle or auto for the day instead of walking.',
    attractions: [
      { name: 'Jahaz Mahal', image: wiki('thumb/b/ba/Jahaz_Mahal_on_the_bank_of_Hauz-i-Shamsi.jpg/960px-Jahaz_Mahal_on_the_bank_of_Hauz-i-Shamsi.jpg') },
      { name: 'Hoshang Shah’s Tomb', image: wiki('thumb/5/5b/Hoshang_Shah%27s_Tomb_02.jpg/960px-Hoshang_Shah%27s_Tomb_02.jpg') },
      { name: 'Roopmati Pavilion', image: wiki('thumb/c/c9/Roopmati_Pavilion_with_arch.jpg/960px-Roopmati_Pavilion_with_arch.jpg') },
    ],
  },
  {
    id: 'tirthan',
    name: 'Tirthan Valley',
    location: 'Himachal Pradesh, India',
    category: 'Mountains',
    hiddenGem: true,
    image: wiki('thumb/9/94/Tirthan_River_Tirthan_Valley_DSC00968.jpg/960px-Tirthan_River_Tirthan_Valley_DSC00968.jpg'),
    description:
      'A calm trout-stream valley at the edge of the Great Himalayan National Park, a UNESCO World Heritage Site, with homestays, forest trails and no party crowd.',
    bestTime: 'March to June and September to November',
    coords: { lat: 31.6419, lon: 77.4395 },
    ticket: {
      label: '₹50–100/day',
      amount: 50,
      note: 'Great Himalayan National Park entry permit for Indians. Guides disagree on the exact rate, so confirm at the Sai Ropa office. Treks cost extra.',
    },
    website: 'https://hptdc.in',
    tip: 'Book a family-run homestay near Gushaini and ask the host for a day trek or a fishing spot. Hosts often know trails not on any map.',
    attractions: [
      { name: 'Tirthan River', image: wiki('thumb/9/94/Tirthan_River_Tirthan_Valley_DSC00968.jpg/960px-Tirthan_River_Tirthan_Valley_DSC00968.jpg') },
      { name: 'Jalori Pass', image: wiki('thumb/2/22/A_view_of_the_Himalayas_at_Jalori_pass_Himachal_Pradesh_India.jpg/960px-A_view_of_the_Himalayas_at_Jalori_pass_Himachal_Pradesh_India.jpg') },
      { name: 'Serolsar Lake', image: wiki('thumb/f/fc/Serolsar_Lake_2.jpg/960px-Serolsar_Lake_2.jpg') },
    ],
  },
  {
    id: 'gokarna',
    name: 'Gokarna (Half Moon Beach)',
    location: 'Karnataka, India',
    category: 'Beaches',
    hiddenGem: true,
    image: wiki('thumb/5/53/PXL_20260103_101009613_People_and_Beach_Om_Beach_Gokarna%2C_Karnataka_35.jpg/960px-PXL_20260103_101009613_People_and_Beach_Om_Beach_Gokarna%2C_Karnataka_35.jpg'),
    description:
      'A laid-back temple town with quiet cliff-backed beaches. Half Moon Beach is reachable only by a jungle trek or boat, so it stays peaceful.',
    bestTime: 'October to March',
    coords: { lat: 14.5479, lon: 74.3188 },
    ticket: {
      label: 'Free',
      amount: 0,
      note: 'No entry fee for the beaches. Guided trek packages (₹4,000+) are optional and charge for their own services.',
    },
    website: 'https://karnatakatourism.org/en/blogs/gokarna-beaches',
    tip: 'Walk the cliff trail from Om Beach south (about 30 minutes) in the morning. Carry water, as there are very few shops on the trail.',
    attractions: [
      { name: 'Om Beach', image: wiki('thumb/5/53/PXL_20260103_101009613_People_and_Beach_Om_Beach_Gokarna%2C_Karnataka_35.jpg/960px-PXL_20260103_101009613_People_and_Beach_Om_Beach_Gokarna%2C_Karnataka_35.jpg') },
      { name: 'Gokarna Coast', image: wiki('thumb/e/ea/Gokarna.JPG/960px-Gokarna.JPG') },
    ],
  },
  {
    id: 'ziro',
    name: 'Ziro Valley',
    location: 'Arunachal Pradesh, India',
    category: 'Adventure',
    hiddenGem: true,
    image: wiki('thumb/6/61/Ziro_valley_of_Aruncahl_in_summer_season.jpg/960px-Ziro_valley_of_Aruncahl_in_summer_season.jpg'),
    description:
      'A high plateau of rice fields and pine hills, home of the Apatani people, for cycling, village walks and trekking far from the tourist circuit.',
    bestTime: 'March to October (the music festival is usually late September)',
    coords: { lat: 27.5445, lon: 93.8294 },
    ticket: {
      label: 'Permit needed',
      amount: null,
      note: 'Indian visitors need an Inner Line Permit (valid about 15 days) for Arunachal Pradesh. I could not confirm the fee, so check the official portal.',
    },
    website: 'https://arunachalpradesh.gov.in',
    tip: 'Apply for the Inner Line Permit online before you travel. Rent a bike and explore the Apatani villages around Hong and Hari.',
    attractions: [
      { name: 'Ziro Valley', image: wiki('thumb/d/d0/Ziro_and_its_green_valley.jpg/960px-Ziro_and_its_green_valley.jpg') },
      { name: 'Apatani Culture', image: wiki('thumb/7/7d/Apatani_culture.jpg/960px-Apatani_culture.jpg') },
    ],
  },
  {
    id: 'kaziranga',
    name: 'Kaziranga National Park',
    location: 'Assam, India',
    category: 'Adventure',
    image: wiki('thumb/3/3c/Indian_rhinoceros_in_Kaziranga_National_Park_March_2025_by_Tisha_Mukherjee_06.jpg/960px-Indian_rhinoceros_in_Kaziranga_National_Park_March_2025_by_Tisha_Mukherjee_06.jpg'),
    description:
      'A UNESCO World Heritage Site on the Brahmaputra floodplain, home to the world’s largest population of the Indian one-horned rhinoceros, plus elephants, swamp deer and rich birdlife.',
    bestTime: 'November to April (the park is closed in the monsoon)',
    coords: { lat: 26.5775, lon: 93.1711 },
    attractions: [
      { name: 'One-horned Rhinoceros', image: wiki('thumb/3/3c/Indian_rhinoceros_in_Kaziranga_National_Park_March_2025_by_Tisha_Mukherjee_06.jpg/960px-Indian_rhinoceros_in_Kaziranga_National_Park_March_2025_by_Tisha_Mukherjee_06.jpg') },
      { name: 'Jeep Safari (Central Zone)', image: wiki('thumb/2/2a/Jeep_Safari_Kaziranga%2C_Central_Zone_%28Kohara%29.jpg/960px-Jeep_Safari_Kaziranga%2C_Central_Zone_%28Kohara%29.jpg') },
      { name: 'Elephant Safari', image: wiki('thumb/1/15/Elephant_safari_at_Kaziranga_National_Park%2C_Assam.jpg/960px-Elephant_safari_at_Kaziranga_National_Park%2C_Assam.jpg') },
    ],
  },
];

/** Final destination list: base data plus trip-planning guide fields. */
export type Destination = BaseDestination & Guide;

export const DESTINATIONS: Destination[] = BASE_DESTINATIONS.map((d) => ({ ...d, ...GUIDE[d.id] }));
