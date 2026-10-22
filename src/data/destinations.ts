export type Category = 'Beaches' | 'Mountains' | 'Heritage' | 'Adventure';

export const CATEGORIES: Category[] = ['Beaches', 'Mountains', 'Heritage', 'Adventure'];

export interface Attraction {
  name: string;
  image: string;
}

export interface Destination {
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
}

const wiki = (path: string) => `https://upload.wikimedia.org/wikipedia/commons/${path}`;

/** Static destination data (no backend required). */
export const DESTINATIONS: Destination[] = [
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
];
