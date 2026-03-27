/**
 * ═══════════════════════════════════════════════════════════
 *  Thread Brand Libraries
 *  Madeira Polyneon, Isacord, Marathon Viscose colour databases
 * ═══════════════════════════════════════════════════════════
 */

export interface ThreadColour {
  code: string;
  name: string;
  hex: string; // CSS hex colour for preview
  rgb: [number, number, number];
  brand: string;
  range: string; // sub-range within brand
  isMetallic?: boolean;
  isNeon?: boolean;
  isVariegated?: boolean;
}

export interface ThreadBrand {
  key: string;
  label: string;
  ranges: string[];
  colours: ThreadColour[];
}

/* ── Madeira Polyneon (polyester - most popular UK/IE commercial thread) ── */

const MADEIRA_POLYNEON: ThreadColour[] = [
  // Whites & Creams
  { code: "1801", name: "White", hex: "#FFFFFF", rgb: [255, 255, 255], brand: "madeira", range: "polyneon" },
  { code: "1812", name: "Ivory", hex: "#FFFFF0", rgb: [255, 255, 240], brand: "madeira", range: "polyneon" },
  { code: "1860", name: "Cream", hex: "#FFFDD0", rgb: [255, 253, 208], brand: "madeira", range: "polyneon" },
  { code: "1815", name: "Eggshell", hex: "#F0EAD6", rgb: [240, 234, 214], brand: "madeira", range: "polyneon" },
  // Blacks & Greys
  { code: "1800", name: "Black", hex: "#000000", rgb: [0, 0, 0], brand: "madeira", range: "polyneon" },
  { code: "1841", name: "Dark Grey", hex: "#404040", rgb: [64, 64, 64], brand: "madeira", range: "polyneon" },
  { code: "1842", name: "Steel Grey", hex: "#71797E", rgb: [113, 121, 126], brand: "madeira", range: "polyneon" },
  { code: "1843", name: "Ash Grey", hex: "#B2BEB5", rgb: [178, 190, 181], brand: "madeira", range: "polyneon" },
  { code: "1818", name: "Pewter", hex: "#8E8E8E", rgb: [142, 142, 142], brand: "madeira", range: "polyneon" },
  { code: "1840", name: "Silver Grey", hex: "#C0C0C0", rgb: [192, 192, 192], brand: "madeira", range: "polyneon" },
  // Reds
  { code: "1839", name: "Christmas Red", hex: "#CC0000", rgb: [204, 0, 0], brand: "madeira", range: "polyneon" },
  { code: "1837", name: "Fire Red", hex: "#FF0000", rgb: [255, 0, 0], brand: "madeira", range: "polyneon" },
  { code: "1838", name: "Cardinal Red", hex: "#C41E3A", rgb: [196, 30, 58], brand: "madeira", range: "polyneon" },
  { code: "1836", name: "Scarlet", hex: "#FF2400", rgb: [255, 36, 0], brand: "madeira", range: "polyneon" },
  { code: "1921", name: "Brick Red", hex: "#CB4154", rgb: [203, 65, 84], brand: "madeira", range: "polyneon" },
  { code: "1835", name: "Burgundy", hex: "#800020", rgb: [128, 0, 32], brand: "madeira", range: "polyneon" },
  { code: "1834", name: "Wine", hex: "#722F37", rgb: [114, 47, 55], brand: "madeira", range: "polyneon" },
  { code: "1833", name: "Maroon", hex: "#800000", rgb: [128, 0, 0], brand: "madeira", range: "polyneon" },
  { code: "1832", name: "Dark Maroon", hex: "#590018", rgb: [89, 0, 24], brand: "madeira", range: "polyneon" },
  // Pinks
  { code: "1816", name: "Baby Pink", hex: "#F4C2C2", rgb: [244, 194, 194], brand: "madeira", range: "polyneon" },
  { code: "1817", name: "Rose Pink", hex: "#FF66CC", rgb: [255, 102, 204], brand: "madeira", range: "polyneon" },
  { code: "1819", name: "Hot Pink", hex: "#FF69B4", rgb: [255, 105, 180], brand: "madeira", range: "polyneon" },
  { code: "1820", name: "Fuchsia", hex: "#FF00FF", rgb: [255, 0, 255], brand: "madeira", range: "polyneon" },
  { code: "1831", name: "Coral", hex: "#FF7F50", rgb: [255, 127, 80], brand: "madeira", range: "polyneon" },
  { code: "1921", name: "Dusty Rose", hex: "#DCAE96", rgb: [220, 174, 150], brand: "madeira", range: "polyneon" },
  // Blues
  { code: "1842", name: "Navy", hex: "#000080", rgb: [0, 0, 128], brand: "madeira", range: "polyneon" },
  { code: "1843", name: "Dark Navy", hex: "#001040", rgb: [0, 16, 64], brand: "madeira", range: "polyneon" },
  { code: "1829", name: "Royal Blue", hex: "#4169E1", rgb: [65, 105, 225], brand: "madeira", range: "polyneon" },
  { code: "1828", name: "Bright Blue", hex: "#0000FF", rgb: [0, 0, 255], brand: "madeira", range: "polyneon" },
  { code: "1827", name: "Sky Blue", hex: "#87CEEB", rgb: [135, 206, 235], brand: "madeira", range: "polyneon" },
  { code: "1826", name: "Baby Blue", hex: "#89CFF0", rgb: [137, 207, 240], brand: "madeira", range: "polyneon" },
  { code: "1830", name: "Cobalt", hex: "#0047AB", rgb: [0, 71, 171], brand: "madeira", range: "polyneon" },
  { code: "1825", name: "Cornflower", hex: "#6495ED", rgb: [100, 149, 237], brand: "madeira", range: "polyneon" },
  { code: "1846", name: "Teal", hex: "#008080", rgb: [0, 128, 128], brand: "madeira", range: "polyneon" },
  { code: "1845", name: "Turquoise", hex: "#40E0D0", rgb: [64, 224, 208], brand: "madeira", range: "polyneon" },
  // Greens
  { code: "1850", name: "Forest Green", hex: "#228B22", rgb: [34, 139, 34], brand: "madeira", range: "polyneon" },
  { code: "1851", name: "Dark Green", hex: "#006400", rgb: [0, 100, 0], brand: "madeira", range: "polyneon" },
  { code: "1849", name: "Kelly Green", hex: "#4CBB17", rgb: [76, 187, 23], brand: "madeira", range: "polyneon" },
  { code: "1848", name: "Emerald", hex: "#50C878", rgb: [80, 200, 120], brand: "madeira", range: "polyneon" },
  { code: "1847", name: "Lime Green", hex: "#32CD32", rgb: [50, 205, 50], brand: "madeira", range: "polyneon" },
  { code: "1852", name: "Olive", hex: "#808000", rgb: [128, 128, 0], brand: "madeira", range: "polyneon" },
  { code: "1853", name: "Sage", hex: "#BCB88A", rgb: [188, 184, 138], brand: "madeira", range: "polyneon" },
  { code: "1854", name: "Mint", hex: "#98FF98", rgb: [152, 255, 152], brand: "madeira", range: "polyneon" },
  // Yellows & Golds
  { code: "1860", name: "Bright Yellow", hex: "#FFFF00", rgb: [255, 255, 0], brand: "madeira", range: "polyneon" },
  { code: "1861", name: "Lemon", hex: "#FFF44F", rgb: [255, 244, 79], brand: "madeira", range: "polyneon" },
  { code: "1862", name: "Gold", hex: "#FFD700", rgb: [255, 215, 0], brand: "madeira", range: "polyneon" },
  { code: "1863", name: "Old Gold", hex: "#CFB53B", rgb: [207, 181, 59], brand: "madeira", range: "polyneon" },
  { code: "1864", name: "Amber", hex: "#FFBF00", rgb: [255, 191, 0], brand: "madeira", range: "polyneon" },
  // Oranges
  { code: "1870", name: "Orange", hex: "#FFA500", rgb: [255, 165, 0], brand: "madeira", range: "polyneon" },
  { code: "1871", name: "Tangerine", hex: "#FF9966", rgb: [255, 153, 102], brand: "madeira", range: "polyneon" },
  { code: "1872", name: "Burnt Orange", hex: "#CC5500", rgb: [204, 85, 0], brand: "madeira", range: "polyneon" },
  { code: "1873", name: "Rust", hex: "#B7410E", rgb: [183, 65, 14], brand: "madeira", range: "polyneon" },
  // Purples
  { code: "1880", name: "Purple", hex: "#800080", rgb: [128, 0, 128], brand: "madeira", range: "polyneon" },
  { code: "1881", name: "Dark Purple", hex: "#301934", rgb: [48, 25, 52], brand: "madeira", range: "polyneon" },
  { code: "1882", name: "Violet", hex: "#EE82EE", rgb: [238, 130, 238], brand: "madeira", range: "polyneon" },
  { code: "1883", name: "Lavender", hex: "#E6E6FA", rgb: [230, 230, 250], brand: "madeira", range: "polyneon" },
  { code: "1884", name: "Lilac", hex: "#C8A2C8", rgb: [200, 162, 200], brand: "madeira", range: "polyneon" },
  { code: "1885", name: "Plum", hex: "#8E4585", rgb: [142, 69, 133], brand: "madeira", range: "polyneon" },
  // Browns
  { code: "1890", name: "Brown", hex: "#8B4513", rgb: [139, 69, 19], brand: "madeira", range: "polyneon" },
  { code: "1891", name: "Dark Brown", hex: "#3B2F2F", rgb: [59, 47, 47], brand: "madeira", range: "polyneon" },
  { code: "1892", name: "Chocolate", hex: "#7B3F00", rgb: [123, 63, 0], brand: "madeira", range: "polyneon" },
  { code: "1893", name: "Tan", hex: "#D2B48C", rgb: [210, 180, 140], brand: "madeira", range: "polyneon" },
  { code: "1894", name: "Beige", hex: "#F5F5DC", rgb: [245, 245, 220], brand: "madeira", range: "polyneon" },
  { code: "1895", name: "Khaki", hex: "#C3B091", rgb: [195, 176, 145], brand: "madeira", range: "polyneon" },
];

/* ── Madeira Metallic ── */

const MADEIRA_METALLIC: ThreadColour[] = [
  { code: "GOLD1", name: "Gold 1", hex: "#FFD700", rgb: [255, 215, 0], brand: "madeira", range: "metallic", isMetallic: true },
  { code: "GOLD3", name: "Gold 3 (Dark)", hex: "#B8860B", rgb: [184, 134, 11], brand: "madeira", range: "metallic", isMetallic: true },
  { code: "SILV1", name: "Silver 1", hex: "#C0C0C0", rgb: [192, 192, 192], brand: "madeira", range: "metallic", isMetallic: true },
  { code: "SILV2", name: "Silver 2 (Dark)", hex: "#A9A9A9", rgb: [169, 169, 169], brand: "madeira", range: "metallic", isMetallic: true },
  { code: "COPP1", name: "Copper", hex: "#B87333", rgb: [184, 115, 51], brand: "madeira", range: "metallic", isMetallic: true },
  { code: "BRNZ1", name: "Bronze", hex: "#CD7F32", rgb: [205, 127, 50], brand: "madeira", range: "metallic", isMetallic: true },
  { code: "RED1", name: "Red Metallic", hex: "#FF0000", rgb: [255, 0, 0], brand: "madeira", range: "metallic", isMetallic: true },
  { code: "BLUE1", name: "Blue Metallic", hex: "#0000FF", rgb: [0, 0, 255], brand: "madeira", range: "metallic", isMetallic: true },
  { code: "GRN1", name: "Green Metallic", hex: "#008000", rgb: [0, 128, 0], brand: "madeira", range: "metallic", isMetallic: true },
  { code: "PRPL1", name: "Purple Metallic", hex: "#800080", rgb: [128, 0, 128], brand: "madeira", range: "metallic", isMetallic: true },
];

/* ── Isacord Polyester (popular US brand, widely available) ── */

const ISACORD: ThreadColour[] = [
  // Whites & Neutrals
  { code: "0010", name: "Silky White", hex: "#FAFAFA", rgb: [250, 250, 250], brand: "isacord", range: "polyester" },
  { code: "0015", name: "White", hex: "#FFFFFF", rgb: [255, 255, 255], brand: "isacord", range: "polyester" },
  { code: "0101", name: "Eggshell", hex: "#F0EAD6", rgb: [240, 234, 214], brand: "isacord", range: "polyester" },
  { code: "0151", name: "Cloud", hex: "#F5F5F5", rgb: [245, 245, 245], brand: "isacord", range: "polyester" },
  { code: "0170", name: "Bone", hex: "#E3DAC9", rgb: [227, 218, 201], brand: "isacord", range: "polyester" },
  // Blacks & Greys
  { code: "0020", name: "Black", hex: "#000000", rgb: [0, 0, 0], brand: "isacord", range: "polyester" },
  { code: "0112", name: "Lead", hex: "#333333", rgb: [51, 51, 51], brand: "isacord", range: "polyester" },
  { code: "0108", name: "Dark Grey", hex: "#555555", rgb: [85, 85, 85], brand: "isacord", range: "polyester" },
  { code: "0142", name: "Sterling", hex: "#888888", rgb: [136, 136, 136], brand: "isacord", range: "polyester" },
  { code: "0145", name: "Ash", hex: "#B0B0B0", rgb: [176, 176, 176], brand: "isacord", range: "polyester" },
  { code: "0150", name: "Mystik Grey", hex: "#CCCCCC", rgb: [204, 204, 204], brand: "isacord", range: "polyester" },
  // Reds
  { code: "1800", name: "Wildfire", hex: "#EE2C2C", rgb: [238, 44, 44], brand: "isacord", range: "polyester" },
  { code: "1902", name: "Poinsettia", hex: "#CC0033", rgb: [204, 0, 51], brand: "isacord", range: "polyester" },
  { code: "1904", name: "Cardinal", hex: "#C41E3A", rgb: [196, 30, 58], brand: "isacord", range: "polyester" },
  { code: "1913", name: "Cherry", hex: "#DE3163", rgb: [222, 49, 99], brand: "isacord", range: "polyester" },
  { code: "1911", name: "Foliage Rose", hex: "#B22222", rgb: [178, 34, 34], brand: "isacord", range: "polyester" },
  { code: "2011", name: "Beet Red", hex: "#8B0000", rgb: [139, 0, 0], brand: "isacord", range: "polyester" },
  { code: "2115", name: "Bordeaux", hex: "#5C0029", rgb: [92, 0, 41], brand: "isacord", range: "polyester" },
  // Blues
  { code: "3600", name: "Swedish Blue", hex: "#006AA7", rgb: [0, 106, 167], brand: "isacord", range: "polyester" },
  { code: "3612", name: "Starlight Blue", hex: "#1F75FE", rgb: [31, 117, 254], brand: "isacord", range: "polyester" },
  { code: "3620", name: "Marine Blue", hex: "#005B99", rgb: [0, 91, 153], brand: "isacord", range: "polyester" },
  { code: "3622", name: "Imperial Blue", hex: "#002395", rgb: [0, 35, 149], brand: "isacord", range: "polyester" },
  { code: "3645", name: "French Blue", hex: "#0072BB", rgb: [0, 114, 187], brand: "isacord", range: "polyester" },
  { code: "3732", name: "Dusty Blue", hex: "#6699CC", rgb: [102, 153, 204], brand: "isacord", range: "polyester" },
  { code: "3743", name: "Harbor", hex: "#3B5998", rgb: [59, 89, 152], brand: "isacord", range: "polyester" },
  { code: "3901", name: "Tropical Blue", hex: "#00CED1", rgb: [0, 206, 209], brand: "isacord", range: "polyester" },
  { code: "3910", name: "Crystal Blue", hex: "#68A0B0", rgb: [104, 160, 176], brand: "isacord", range: "polyester" },
  { code: "3344", name: "Navy Blue", hex: "#000080", rgb: [0, 0, 128], brand: "isacord", range: "polyester" },
  // Greens
  { code: "5324", name: "Bright Green", hex: "#00A550", rgb: [0, 165, 80], brand: "isacord", range: "polyester" },
  { code: "5326", name: "Evergreen", hex: "#1B4D3E", rgb: [27, 77, 62], brand: "isacord", range: "polyester" },
  { code: "5422", name: "Swiss Ivy", hex: "#3B7A57", rgb: [59, 122, 87], brand: "isacord", range: "polyester" },
  { code: "5531", name: "Starfish", hex: "#7FFF00", rgb: [127, 255, 0], brand: "isacord", range: "polyester" },
  { code: "5552", name: "Palm Leaf", hex: "#556B2F", rgb: [85, 107, 47], brand: "isacord", range: "polyester" },
  { code: "5643", name: "Yellowgreen", hex: "#9DC209", rgb: [157, 194, 9], brand: "isacord", range: "polyester" },
  { code: "5933", name: "Sage", hex: "#BCB88A", rgb: [188, 184, 138], brand: "isacord", range: "polyester" },
  // Yellows & Golds
  { code: "0600", name: "Bright Yellow", hex: "#FFD300", rgb: [255, 211, 0], brand: "isacord", range: "polyester" },
  { code: "0605", name: "Daisy", hex: "#FFFF00", rgb: [255, 255, 0], brand: "isacord", range: "polyester" },
  { code: "0622", name: "Star Gold", hex: "#FFD700", rgb: [255, 215, 0], brand: "isacord", range: "polyester" },
  { code: "0700", name: "Bright Orange", hex: "#FF6600", rgb: [255, 102, 0], brand: "isacord", range: "polyester" },
  { code: "0800", name: "Tangerine", hex: "#FF9966", rgb: [255, 153, 102], brand: "isacord", range: "polyester" },
  { code: "0811", name: "Candlelight", hex: "#FFEFD5", rgb: [255, 239, 213], brand: "isacord", range: "polyester" },
  // Purples
  { code: "2810", name: "Orchid", hex: "#DA70D6", rgb: [218, 112, 214], brand: "isacord", range: "polyester" },
  { code: "2905", name: "Iris Blue", hex: "#5A4FCF", rgb: [90, 79, 207], brand: "isacord", range: "polyester" },
  { code: "2910", name: "Grape", hex: "#6F2DA8", rgb: [111, 45, 168], brand: "isacord", range: "polyester" },
  { code: "3045", name: "Eggplant", hex: "#311432", rgb: [49, 20, 50], brand: "isacord", range: "polyester" },
  { code: "3114", name: "Purple Twist", hex: "#9370DB", rgb: [147, 112, 219], brand: "isacord", range: "polyester" },
  // Pinks
  { code: "2220", name: "Tropicana", hex: "#FF6FFF", rgb: [255, 111, 255], brand: "isacord", range: "polyester" },
  { code: "2300", name: "Bright Ruby", hex: "#E0115F", rgb: [224, 17, 95], brand: "isacord", range: "polyester" },
  { code: "2532", name: "Soft Pink", hex: "#FFB6C1", rgb: [255, 182, 193], brand: "isacord", range: "polyester" },
  { code: "2560", name: "Azalea Pink", hex: "#F19CBB", rgb: [241, 156, 187], brand: "isacord", range: "polyester" },
  // Browns
  { code: "1055", name: "Bark", hex: "#795C34", rgb: [121, 92, 52], brand: "isacord", range: "polyester" },
  { code: "1154", name: "Penny", hex: "#B87333", rgb: [184, 115, 51], brand: "isacord", range: "polyester" },
  { code: "1252", name: "Ivory", hex: "#FFFFF0", rgb: [255, 255, 240], brand: "isacord", range: "polyester" },
  { code: "1375", name: "Dark Tan", hex: "#918151", rgb: [145, 129, 81], brand: "isacord", range: "polyester" },
  { code: "1565", name: "Espresso", hex: "#3C1414", rgb: [60, 20, 20], brand: "isacord", range: "polyester" },
];

/* ── Marathon Viscose Rayon (popular UK/IE budget thread) ── */

const MARATHON_VISCOSE: ThreadColour[] = [
  // Core colours
  { code: "1001", name: "White", hex: "#FFFFFF", rgb: [255, 255, 255], brand: "marathon", range: "viscose" },
  { code: "1002", name: "Black", hex: "#000000", rgb: [0, 0, 0], brand: "marathon", range: "viscose" },
  { code: "1003", name: "Bright Red", hex: "#FF0000", rgb: [255, 0, 0], brand: "marathon", range: "viscose" },
  { code: "1004", name: "Dark Red", hex: "#8B0000", rgb: [139, 0, 0], brand: "marathon", range: "viscose" },
  { code: "1005", name: "Burgundy", hex: "#800020", rgb: [128, 0, 32], brand: "marathon", range: "viscose" },
  { code: "1006", name: "Royal Blue", hex: "#4169E1", rgb: [65, 105, 225], brand: "marathon", range: "viscose" },
  { code: "1007", name: "Navy Blue", hex: "#000080", rgb: [0, 0, 128], brand: "marathon", range: "viscose" },
  { code: "1008", name: "Dark Navy", hex: "#001040", rgb: [0, 16, 64], brand: "marathon", range: "viscose" },
  { code: "1009", name: "Sky Blue", hex: "#87CEEB", rgb: [135, 206, 235], brand: "marathon", range: "viscose" },
  { code: "1010", name: "Baby Blue", hex: "#89CFF0", rgb: [137, 207, 240], brand: "marathon", range: "viscose" },
  { code: "1011", name: "Kelly Green", hex: "#4CBB17", rgb: [76, 187, 23], brand: "marathon", range: "viscose" },
  { code: "1012", name: "Forest Green", hex: "#228B22", rgb: [34, 139, 34], brand: "marathon", range: "viscose" },
  { code: "1013", name: "Dark Green", hex: "#006400", rgb: [0, 100, 0], brand: "marathon", range: "viscose" },
  { code: "1014", name: "Lime", hex: "#32CD32", rgb: [50, 205, 50], brand: "marathon", range: "viscose" },
  { code: "1015", name: "Yellow", hex: "#FFFF00", rgb: [255, 255, 0], brand: "marathon", range: "viscose" },
  { code: "1016", name: "Gold", hex: "#FFD700", rgb: [255, 215, 0], brand: "marathon", range: "viscose" },
  { code: "1017", name: "Orange", hex: "#FFA500", rgb: [255, 165, 0], brand: "marathon", range: "viscose" },
  { code: "1018", name: "Brown", hex: "#8B4513", rgb: [139, 69, 19], brand: "marathon", range: "viscose" },
  { code: "1019", name: "Dark Brown", hex: "#3B2F2F", rgb: [59, 47, 47], brand: "marathon", range: "viscose" },
  { code: "1020", name: "Tan", hex: "#D2B48C", rgb: [210, 180, 140], brand: "marathon", range: "viscose" },
  { code: "1021", name: "Purple", hex: "#800080", rgb: [128, 0, 128], brand: "marathon", range: "viscose" },
  { code: "1022", name: "Violet", hex: "#EE82EE", rgb: [238, 130, 238], brand: "marathon", range: "viscose" },
  { code: "1023", name: "Pink", hex: "#FFC0CB", rgb: [255, 192, 203], brand: "marathon", range: "viscose" },
  { code: "1024", name: "Hot Pink", hex: "#FF69B4", rgb: [255, 105, 180], brand: "marathon", range: "viscose" },
  { code: "1025", name: "Fuchsia", hex: "#FF00FF", rgb: [255, 0, 255], brand: "marathon", range: "viscose" },
  { code: "1026", name: "Grey", hex: "#808080", rgb: [128, 128, 128], brand: "marathon", range: "viscose" },
  { code: "1027", name: "Silver", hex: "#C0C0C0", rgb: [192, 192, 192], brand: "marathon", range: "viscose" },
  { code: "1028", name: "Cream", hex: "#FFFDD0", rgb: [255, 253, 208], brand: "marathon", range: "viscose" },
  { code: "1029", name: "Teal", hex: "#008080", rgb: [0, 128, 128], brand: "marathon", range: "viscose" },
  { code: "1030", name: "Turquoise", hex: "#40E0D0", rgb: [64, 224, 208], brand: "marathon", range: "viscose" },
];

/* ── Assembled Brand Databases ── */

export const THREAD_BRANDS: Record<string, ThreadBrand> = {
  madeira: {
    key: "madeira",
    label: "Madeira",
    ranges: ["polyneon", "metallic"],
    colours: [...MADEIRA_POLYNEON, ...MADEIRA_METALLIC],
  },
  isacord: {
    key: "isacord",
    label: "Isacord",
    ranges: ["polyester"],
    colours: ISACORD,
  },
  marathon: {
    key: "marathon",
    label: "Marathon",
    ranges: ["viscose"],
    colours: MARATHON_VISCOSE,
  },
};

/* ── Colour Matching Utilities ── */

/**
 * Find the closest thread colour to a given hex/rgb value
 * Uses CIE76 delta-E approximation for perceptual color distance
 */
export function findClosestThread(
  targetHex: string,
  brand?: string
): { colour: ThreadColour; distance: number }[] {
  const targetRgb = hexToRgb(targetHex);
  if (!targetRgb) return [];

  const targetLab = rgbToLab(targetRgb);

  let allColours: ThreadColour[] = [];
  if (brand && THREAD_BRANDS[brand]) {
    allColours = THREAD_BRANDS[brand].colours;
  } else {
    allColours = Object.values(THREAD_BRANDS).flatMap((b) => b.colours);
  }

  const results = allColours.map((colour) => {
    const lab = rgbToLab(colour.rgb);
    const distance = deltaE(targetLab, lab);
    return { colour, distance };
  });

  results.sort((a, b) => a.distance - b.distance);

  return results.slice(0, 10);
}

/**
 * Search threads by name or code
 */
export function searchThreads(
  query: string,
  brand?: string
): ThreadColour[] {
  const q = query.toLowerCase();

  let allColours: ThreadColour[] = [];
  if (brand && THREAD_BRANDS[brand]) {
    allColours = THREAD_BRANDS[brand].colours;
  } else {
    allColours = Object.values(THREAD_BRANDS).flatMap((b) => b.colours);
  }

  return allColours.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.brand.toLowerCase().includes(q)
  );
}

/* ── Colour Space Conversion Helpers ── */

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

function rgbToLab(rgb: [number, number, number]): [number, number, number] {
  // Normalize to 0-1
  let r = rgb[0] / 255;
  let g = rgb[1] / 255;
  let b = rgb[2] / 255;

  // sRGB to linear RGB
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // RGB to XYZ (D65 illuminant)
  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.00000;
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;

  // XYZ to Lab
  x = x > 0.008856 ? Math.cbrt(x) : (7.787 * x) + 16 / 116;
  y = y > 0.008856 ? Math.cbrt(y) : (7.787 * y) + 16 / 116;
  z = z > 0.008856 ? Math.cbrt(z) : (7.787 * z) + 16 / 116;

  const L = (116 * y) - 16;
  const A = 500 * (x - y);
  const B = 200 * (y - z);

  return [L, A, B];
}

function deltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(lab1[0] - lab2[0], 2) +
    Math.pow(lab1[1] - lab2[1], 2) +
    Math.pow(lab1[2] - lab2[2], 2)
  );
}
