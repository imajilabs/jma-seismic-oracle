// data.js
// Bundled snapshot of on-chain seismic attestations + supporting datasets.
// The live RPC client in sui.js can extend / refresh ATTESTATIONS at runtime.

export const ORACLE_PACKAGE  = '0xd5b734ff48a3361c6882b21ed82b7903bf411ef29dc12acc407d4b127f9a2526';
export const ORACLE_MODULE   = 'oracle';
export const TRIGGER_EVENT   = `${ORACLE_PACKAGE}::${ORACLE_MODULE}::TriggerAttested`;
export const SUI_RPC         = 'https://fullnode.testnet.sui.io:443';
export const EXPLORER_TX     = (digest) => `https://testnet.suivision.xyz/txblock/${digest}?tab=Events`;
export const EXPLORER_OBJ    = (id)     => `https://testnet.suivision.xyz/object/${id}`;

// Snapshot pulled from chain: tx AwnENjXH33DtkvmdiNk5PRPeAWAofA1H9ZvXcacji6Qt
export const ATTESTATIONS = [
  {
    serial: 1,
    attestation_id: '0xdd8d3f3cedda908dee948631934c31d9ffaa3123c1e461044a59dfb58c1b1647',
    tx_digest:      'AwnENjXH33DtkvmdiNk5PRPeAWAofA1H9ZvXcacji6Qt',
    event_id:       '20260522152219',     // JMA event id (yyyymmddHHMMSS, JST)
    occurred_at_ms: 1779430920000,
    attested_at_ms: 1779430920500,
    max_shindo: { level: 2, band: null }, // 0..7; band: 'lower' | 'upper' for 5/6
    hypocenter: {
      lat: 44.1,
      lng: 141.8,
      depth_km: 10,
      magnitude: 3.40,
    },
    source_xml_hash: 'b6be6592bc0bcc932d48612d42b805268e4afe15aeefba7bf47a9e8321fd93c9',
  },
];

// Shindo (Japanese seismic intensity) colour ramp — perceptual cool-to-hot.
// Indexed by an effective rank: 0,1,2,3,4,5L,5U,6L,6U,7
export const SHINDO_RANK = (s) => {
  if (s.level <= 4) return s.level;
  if (s.level === 5) return s.band === 'upper' ? 6 : 5;
  if (s.level === 6) return s.band === 'upper' ? 8 : 7;
  return 9; // 7
};
export const SHINDO_LABEL = (s) => {
  if (s.level <= 4) return String(s.level);
  if (s.level === 5) return s.band === 'upper' ? '5+' : '5-';
  if (s.level === 6) return s.band === 'upper' ? '6+' : '6-';
  return '7';
};
export const SHINDO_COLORS = [
  '#3dd6c9', // 0 imperceptible
  '#65d488', // 1 felt by some
  '#cbd24a', // 2 felt by most indoors
  '#ffb637', // 3 felt by all
  '#ff6a3d', // 4 strong, some run outside
  '#ff3d6a', // 5- furniture moves
  '#ff1a4a', // 5+ hard to walk
  '#e62e8c', // 6- furniture falls
  '#c92ac0', // 6+ buildings damaged
  '#9b3dff', // 7 catastrophic
];
export const SHINDO_NAME = [
  'Imperceptible', 'Felt by some', 'Felt indoors', 'Felt by all',
  'Strong', 'Furniture shifts', 'Hard to stand',
  'Heavy damage', 'Buildings collapse', 'Catastrophic',
];

// Compact Japanese city dataset for impact-arc destinations.
// Latitudes/longitudes from public records, rounded for compactness.
export const JP_CITIES = [
  { name: 'Tokyo',       lat: 35.6762, lng: 139.6503, pop: 13960000 },
  { name: 'Yokohama',    lat: 35.4437, lng: 139.6380, pop: 3760000  },
  { name: 'Osaka',       lat: 34.6937, lng: 135.5023, pop: 2750000  },
  { name: 'Nagoya',      lat: 35.1815, lng: 136.9066, pop: 2330000  },
  { name: 'Sapporo',     lat: 43.0618, lng: 141.3545, pop: 1960000  },
  { name: 'Fukuoka',     lat: 33.5904, lng: 130.4017, pop: 1610000  },
  { name: 'Kobe',        lat: 34.6901, lng: 135.1955, pop: 1520000  },
  { name: 'Kawasaki',    lat: 35.5308, lng: 139.7029, pop: 1540000  },
  { name: 'Kyoto',       lat: 35.0116, lng: 135.7681, pop: 1460000  },
  { name: 'Saitama',     lat: 35.8617, lng: 139.6455, pop: 1330000  },
  { name: 'Hiroshima',   lat: 34.3853, lng: 132.4553, pop: 1190000  },
  { name: 'Sendai',      lat: 38.2682, lng: 140.8694, pop: 1090000  },
  { name: 'Chiba',       lat: 35.6074, lng: 140.1065, pop: 980000   },
  { name: 'Kitakyushu',  lat: 33.8835, lng: 130.8754, pop: 940000   },
  { name: 'Sakai',       lat: 34.5733, lng: 135.4830, pop: 830000   },
  { name: 'Niigata',     lat: 37.9026, lng: 139.0237, pop: 790000   },
  { name: 'Hamamatsu',   lat: 34.7108, lng: 137.7261, pop: 790000   },
  { name: 'Kumamoto',    lat: 32.8031, lng: 130.7079, pop: 740000   },
  { name: 'Sagamihara',  lat: 35.5710, lng: 139.3737, pop: 720000   },
  { name: 'Okayama',     lat: 34.6551, lng: 133.9195, pop: 720000   },
  { name: 'Shizuoka',    lat: 34.9756, lng: 138.3828, pop: 690000   },
  { name: 'Kagoshima',   lat: 31.5966, lng: 130.5571, pop: 600000   },
  { name: 'Asahikawa',   lat: 43.7706, lng: 142.3650, pop: 330000   },
  { name: 'Hakodate',    lat: 41.7687, lng: 140.7290, pop: 250000   },
  { name: 'Aomori',      lat: 40.8244, lng: 140.7400, pop: 280000   },
  { name: 'Akita',       lat: 39.7186, lng: 140.1024, pop: 300000   },
  { name: 'Morioka',     lat: 39.7036, lng: 141.1527, pop: 290000   },
  { name: 'Yamagata',    lat: 38.2554, lng: 140.3398, pop: 250000   },
  { name: 'Fukushima',   lat: 37.7503, lng: 140.4676, pop: 280000   },
  { name: 'Mito',        lat: 36.3418, lng: 140.4468, pop: 270000   },
  { name: 'Utsunomiya',  lat: 36.5658, lng: 139.8836, pop: 520000   },
  { name: 'Maebashi',    lat: 36.3895, lng: 139.0634, pop: 330000   },
  { name: 'Nagano',      lat: 36.6485, lng: 138.1812, pop: 370000   },
  { name: 'Kanazawa',    lat: 36.5613, lng: 136.6562, pop: 460000   },
  { name: 'Toyama',      lat: 36.6953, lng: 137.2113, pop: 410000   },
  { name: 'Fukui',       lat: 36.0652, lng: 136.2216, pop: 260000   },
  { name: 'Gifu',        lat: 35.4232, lng: 136.7606, pop: 400000   },
  { name: 'Tsu',         lat: 34.7184, lng: 136.5056, pop: 280000   },
  { name: 'Otsu',        lat: 35.0045, lng: 135.8686, pop: 340000   },
  { name: 'Nara',        lat: 34.6851, lng: 135.8048, pop: 360000   },
  { name: 'Wakayama',    lat: 34.2306, lng: 135.1708, pop: 350000   },
  { name: 'Matsue',      lat: 35.4723, lng: 133.0505, pop: 200000   },
  { name: 'Tottori',     lat: 35.5037, lng: 134.2382, pop: 180000   },
  { name: 'Matsuyama',   lat: 33.8392, lng: 132.7657, pop: 510000   },
  { name: 'Takamatsu',   lat: 34.3401, lng: 134.0434, pop: 420000   },
  { name: 'Kochi',       lat: 33.5597, lng: 133.5311, pop: 330000   },
  { name: 'Tokushima',   lat: 34.0658, lng: 134.5593, pop: 250000   },
  { name: 'Oita',        lat: 33.2382, lng: 131.6126, pop: 480000   },
  { name: 'Miyazaki',    lat: 31.9111, lng: 131.4239, pop: 400000   },
  { name: 'Saga',        lat: 33.2494, lng: 130.2989, pop: 230000   },
  { name: 'Nagasaki',    lat: 32.7503, lng: 129.8779, pop: 410000   },
  { name: 'Naha',        lat: 26.2125, lng: 127.6809, pop: 320000   },
  { name: 'Kushiro',     lat: 42.9849, lng: 144.3814, pop: 170000   },
  { name: 'Obihiro',     lat: 42.9237, lng: 143.1962, pop: 170000   },
  { name: 'Wakkanai',    lat: 45.4159, lng: 141.6739, pop: 33000    },
  { name: 'Kitami',      lat: 43.8030, lng: 143.8908, pop: 120000   },
];

// Haversine distance in km.
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Estimate the effective radius a quake will be felt at, from magnitude + shindo.
// Calibrated against rough JMA reporting envelopes — purely indicative.
export function feltRadiusKm({ hypocenter, max_shindo }) {
  const m = hypocenter.magnitude;
  const rank = SHINDO_RANK(max_shindo);
  // base radius grows roughly as ~2× per magnitude step, anchored so a
  // M3 micro-quake still produces a sensible viz envelope (~100 km).
  const base = 60 * Math.pow(1.9, Math.max(0, m - 3));
  // strong shindo extends the affected zone further than magnitude alone
  // would suggest — shallow-source amplification.
  const shindoMul = 1 + rank * 0.35;
  return base * shindoMul;
}

// Pick the cities that would feel a given quake, with predicted shindo per city.
// Always returns at least `minCount` (the closest cities) so a small quake still
// produces a meaningful viz envelope on the globe.
export function impactedCities(att, { maxCount = 12, minCount = 5 } = {}) {
  const radius = feltRadiusKm(att);
  const sourceRank = SHINDO_RANK(att.max_shindo);

  const scored = JP_CITIES.map(c => {
    const d = distanceKm(att.hypocenter, c);
    const ratio = d / Math.max(radius, 1);
    // attenuation: predicted intensity falls off ~1 unit per doubling of
    // distance past a quarter of the felt radius.
    const predicted = sourceRank - Math.max(0, Math.log2(Math.max(0.25, ratio)) * 1.5);
    return { ...c, distKm: d, predictedRank: predicted };
  }).sort((a, b) => a.distKm - b.distKm);

  // primary set: cities meaningfully within the felt envelope
  const within = scored.filter(c => c.distKm <= radius * 1.6 && c.predictedRank >= 0.2);
  // fallback: always include the N nearest cities so even a M2 quake has
  // visible "impact" arcs on the globe.
  if (within.length < minCount) {
    const extras = scored.filter(c => !within.includes(c)).slice(0, minCount - within.length);
    return [...within, ...extras].slice(0, maxCount);
  }
  return within.slice(0, maxCount);
}
