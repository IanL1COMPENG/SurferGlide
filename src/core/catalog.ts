export interface Cosmetic {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  color: string;
  accent: string;
  rarity: 'Essential' | 'Rare' | 'Epic' | 'Legendary';
}

export const BOARDS: Cosmetic[] = [
  {
    id: 'daybreak',
    name: 'Daybreak',
    subtitle: 'Every great run starts here.',
    price: 0,
    color: '#d4f87b',
    accent: '#164b4c',
    rarity: 'Essential',
  },
  {
    id: 'coral',
    name: 'Coral Crush',
    subtitle: 'A little sun. A lot of style.',
    price: 650,
    color: '#ff826c',
    accent: '#fff0cd',
    rarity: 'Rare',
  },
  {
    id: 'tidal',
    name: 'Tidal Theory',
    subtitle: 'Made for the deep end.',
    price: 1200,
    color: '#70d9ed',
    accent: '#184c8a',
    rarity: 'Rare',
  },
  {
    id: 'orchid',
    name: 'After Hours',
    subtitle: 'Last light, one more ride.',
    price: 2200,
    color: '#c9a0f6',
    accent: '#4c2e83',
    rarity: 'Epic',
  },
  {
    id: 'sunset',
    name: 'Liquid Gold',
    subtitle: 'Leave a golden impression.',
    price: 4000,
    color: '#ffc65a',
    accent: '#b96729',
    rarity: 'Legendary',
  },
  {
    id: 'stealth',
    name: 'Night Current',
    subtitle: 'Quiet board. Loud tricks.',
    price: 6000,
    color: '#243947',
    accent: '#b9ff88',
    rarity: 'Legendary',
  },
];

export const RIDERS: Cosmetic[] = [
  {
    id: 'kai',
    name: 'Kai',
    subtitle: 'Island born. Ocean raised.',
    price: 0,
    color: '#f68d63',
    accent: '#654633',
    rarity: 'Essential',
  },
  {
    id: 'luna',
    name: 'Luna',
    subtitle: 'Always chasing the next wave.',
    price: 900,
    color: '#c1a2f3',
    accent: '#342b3b',
    rarity: 'Rare',
  },
  {
    id: 'reef',
    name: 'Reef',
    subtitle: 'The smoothest line in the lagoon.',
    price: 1800,
    color: '#78cdb8',
    accent: '#392d26',
    rarity: 'Epic',
  },
  {
    id: 'sol',
    name: 'Sol',
    subtitle: 'Sunshine in human form.',
    price: 3200,
    color: '#f5ce64',
    accent: '#ae733c',
    rarity: 'Epic',
  },
];

export const COURSES = [
  {
    id: 'lagoon',
    name: 'Palm Lagoon',
    label: 'THE ISLAND CLASSIC',
    description: 'Turquoise water, soft rollers, and endless good lines.',
    sky: '#a8dce0',
    water: '#159cae',
    sun: '#fff2d7',
    difficulty: 'Easygoing',
    seed: 41,
    icon: 'palm',
  },
  {
    id: 'sunset',
    name: 'Sunset Cove',
    label: 'GOLDEN HOUR',
    description: 'Carve through copper light and chase a new personal best.',
    sky: '#edc2ad',
    water: '#508e9b',
    sun: '#ffd8ae',
    difficulty: 'Flow state',
    seed: 97,
    icon: 'sun',
  },
  {
    id: 'arctic',
    name: 'Glacier Bay',
    label: 'A FRESH PERSPECTIVE',
    description: 'Cool blue peaks. Crisp air. One seriously clean wake.',
    sky: '#b4cbdc',
    water: '#448aa5',
    sun: '#f0f6ff',
    difficulty: 'Stay sharp',
    seed: 163,
    icon: 'mountain',
  },
] as const;
export type CourseId = (typeof COURSES)[number]['id'];

export const RANKS = [
  { name: 'Beachcomber', xp: 0, color: '#b3c7b9' },
  { name: 'Wake Rookie', xp: 2000, color: '#d8a97c' },
  { name: 'Wave Rider', xp: 7000, color: '#a9cbd8' },
  { name: 'Flow Master', xp: 18000, color: '#e6c66d' },
  { name: 'Ocean Legend', xp: 45000, color: '#c6a1e5' },
  { name: 'Glide Elite', xp: 100000, color: '#b8f577' },
] as const;

export function rankFor(xp: number) {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) index = i;
  const rank = RANKS[index];
  const next = RANKS[index + 1];
  return {
    ...rank,
    index,
    next,
    progress: next ? Math.min(1, (xp - rank.xp) / (next.xp - rank.xp)) : 1,
  };
}
