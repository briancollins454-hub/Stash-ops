/**
 * Comprehensive garment color-name → hex mapping.
 * Covers all common supplier color names across Ralawise, PenCarrie, Uneek, AWDis, etc.
 */
const COLOR_MAP: Record<string, string> = {
  // ── Blacks / Greys ──
  black: "#111111",
  "jet black": "#0a0a0a",
  "deep black": "#050505",
  "black smoke": "#2d2d2d",
  charcoal: "#36454f",
  "storm grey": "#4a4a4a",
  "steel grey": "#5a5a5a",
  "graphite heather": "#5c5c5c",
  graphite: "#5c5c5c",
  "dark grey": "#4a4a4a",
  grey: "#9e9e9e",
  gray: "#9e9e9e",
  "heather grey": "#b0b0b0",
  heather: "#b0b0b0",
  "moondust grey": "#c0bfbd",
  "light grey": "#c8c8c8",
  silver: "#c0c0c0",

  // ── Whites / Creams / Neutrals ──
  white: "#f5f5f5",
  "arctic white": "#f8f8ff",
  "vanilla milkshake": "#f3e5c4",
  cream: "#fffdd0",
  beige: "#f5f5dc",
  "natural stone": "#d4c5a9",
  "desert sand": "#edc9af",
  nude: "#e3bc9a",
  tan: "#d2b48c",
  "caramel latte": "#c68e5b",
  "ginger biscuit": "#b5651d",
  khaki: "#c2b280",

  // ── Blues ──
  "airforce blue": "#5d8aa8",
  "sky blue": "#87ceeb",
  sky: "#87ceeb",
  "ice blue": "#d6ecef",
  "baby blue": "#89cff0",
  "hawaiian blue": "#00bfff",
  "lagoon blue": "#2e8b8b",
  "sapphire blue": "#0f52ba",
  "royal blue": "#1565c0",
  royal: "#1565c0",
  "bright royal": "#1565c0",
  blue: "#2196f3",
  "french navy": "#1a237e",
  "new french navy": "#1a237e",
  navy: "#1a237e",
  "oxford navy": "#101c3d",
  "dark navy": "#0d1b2a",
  teal: "#008080",
  aqua: "#00bcd4",
  "turquoise surf": "#00c5cd",
  turquoise: "#40e0d0",
  cobalt: "#0047ab",

  // ── Greens ──
  "bottle green": "#1b5e20",
  bottle: "#1b5e20",
  "forest green": "#228b22",
  "kelly green": "#4caf50",
  green: "#2e7d32",
  "earthy green": "#6b7c4e",
  "dusty green": "#8fbc8f",
  "olive green": "#556b2f",
  olive: "#556b2f",
  "lime green": "#7bc142",
  lime: "#cddc39",
  "pistachio green": "#93c572",
  peppermint: "#98fb98",
  jade: "#00a86b",
  sage: "#9caf88",
  mint: "#98ff98",

  // ── Reds ──
  red: "#c62828",
  "fire red": "#c62828",
  "red hot chilli": "#b22222",
  "classic red": "#cc0000",
  "bright red": "#e60000",
  cranberry: "#9c2542",
  burgundy: "#800020",
  maroon: "#800020",
  wine: "#722f37",
  cherry: "#de3163",
  scarlet: "#ff2400",

  // ── Pinks ──
  pink: "#ec407a",
  "hot pink": "#ff69b4",
  "baby pink": "#f4c2c2",
  "candyfloss pink": "#ffb7c5",
  "dusty pink": "#d4a5a5",
  "dusty rose": "#c9a0a0",
  "festival fuchsia": "#c154c1",
  fuchsia: "#ff00ff",
  "candy pink": "#e4717a",
  magenta: "#ff0090",
  blush: "#de5d83",

  // ── Purples / Lilacs ──
  purple: "#7b1fa2",
  plum: "#673147",
  "digital lavender": "#b4a7d6",
  lavender: "#b4a7d6",
  "dusty lilac": "#b39eb5",
  lilac: "#c8a2c8",
  violet: "#7f00ff",
  mauve: "#e0b0ff",
  grape: "#6f2da8",
  amethyst: "#9966cc",

  // ── Oranges ──
  orange: "#e65100",
  "burnt orange": "#cc5500",
  "orange crush": "#f07427",
  "pumpkin pie": "#e8791d",
  tangerine: "#ff9966",
  coral: "#ff6f61",
  apricot: "#fbceb1",
  peach: "#ffcba4",
  rust: "#b7410e",
  amber: "#ffbf00",

  // ── Yellows / Golds ──
  yellow: "#f9a825",
  "sun yellow": "#f5c71a",
  "bright yellow": "#ffea00",
  "lemon yellow": "#fff44f",
  gold: "#d4a017",
  mustard: "#e1a95f",
  saffron: "#f4c430",

  // ── Browns ──
  brown: "#795548",
  "hot chocolate": "#4e312d",
  "chocolate fudge brownie": "#3e2723",
  chocolate: "#3e2723",
  chestnut: "#954535",
  coffee: "#6f4e37",
  mocha: "#967969",
  camel: "#c19a6b",
};

/**
 * Convert a garment colour name to a CSS hex colour.
 * Tries exact match first, then fuzzy partial matching for compound names.
 */
export function colorToCss(name: string): string {
  const n = name.toLowerCase().trim();

  // Exact match
  if (COLOR_MAP[n]) return COLOR_MAP[n];

  // Try without common suffixes/prefixes
  for (const key of Object.keys(COLOR_MAP)) {
    if (n.includes(key) || key.includes(n)) return COLOR_MAP[key];
  }

  // Fallback: grey dot
  return "#808080";
}
