/**
 * Shared character-avatar contract.
 *
 * Only the IDs listed in AVATAR_CATALOG are accepted. Rendering never places
 * caller-provided text, markup, or colours inside the SVG, so a profile loaded
 * from the network cannot turn an avatar into executable markup.
 */

export type AvatarMode = "photo" | "character";

export type AvatarConfig = {
  version: 2;
  skinTone: `skin-0${1 | 2 | 3 | 4 | 5 | 6}`;
  face: `face-0${1 | 2 | 3 | 4}`;
  hair: `hair-${"01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12"}`;
  hairColor: `hair-color-0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
  eyes: `eyes-0${1 | 2 | 3 | 4 | 5 | 6}`;
  mouth: `mouth-0${1 | 2 | 3 | 4 | 5 | 6}`;
  outfit: `outfit-${"01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10"}`;
  outfitColor: `outfit-color-0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
  accessory: "accessory-none" | `accessory-0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
  background: `background-0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
  eyebrows: `brows-0${1 | 2 | 3 | 4}`;
  nose: `nose-0${1 | 2 | 3}`;
  bottom: `bottom-0${1 | 2 | 3 | 4 | 5 | 6}`;
  bottomColor: `bottom-color-0${1 | 2 | 3 | 4 | 5 | 6}`;
  socks: `socks-0${1 | 2 | 3}`;
  shoes: `shoes-0${1 | 2 | 3 | 4 | 5}`;
  shoeColor: `shoe-color-0${1 | 2 | 3 | 4 | 5 | 6}`;
  headwear: "headwear-none" | `headwear-0${1 | 2 | 3}`;
  bag: "bag-none" | `bag-0${1 | 2 | 3}`;
};

export type AvatarCategory = Exclude<keyof AvatarConfig, "version">;

export type AvatarOption = Readonly<{
  id: string;
  /** Stable English name. Product surfaces can replace it with a translated label. */
  label: string;
  /** Preview swatch where a colour communicates the option better than a mini avatar. */
  swatch?: string;
}>;

const options = <T extends readonly AvatarOption[]>(value: T): T => value;

export const AVATAR_CATALOG = {
  skinTone: options([
    { id: "skin-01", label: "Porcelain", swatch: "#f8d9c5" },
    { id: "skin-02", label: "Warm ivory", swatch: "#efc29f" },
    { id: "skin-03", label: "Honey", swatch: "#d99b69" },
    { id: "skin-04", label: "Caramel", swatch: "#b96f47" },
    { id: "skin-05", label: "Chestnut", swatch: "#865037" },
    { id: "skin-06", label: "Deep brown", swatch: "#583426" },
  ]),
  face: options([
    { id: "face-01", label: "Round" },
    { id: "face-02", label: "Soft" },
    { id: "face-03", label: "Oval" },
    { id: "face-04", label: "Angular" },
  ]),
  hair: options([
    { id: "hair-01", label: "Short crop" },
    { id: "hair-02", label: "Side part" },
    { id: "hair-03", label: "Soft waves" },
    { id: "hair-04", label: "Long straight" },
    { id: "hair-05", label: "Bob" },
    { id: "hair-06", label: "High bun" },
    { id: "hair-07", label: "Curly" },
    { id: "hair-08", label: "Buzz cut" },
    { id: "hair-09", label: "Braids" },
    { id: "hair-10", label: "Ponytail" },
    { id: "hair-11", label: "Afro" },
    { id: "hair-12", label: "Covered" },
  ]),
  hairColor: options([
    { id: "hair-color-01", label: "Black", swatch: "#252428" },
    { id: "hair-color-02", label: "Espresso", swatch: "#493127" },
    { id: "hair-color-03", label: "Chestnut", swatch: "#7a4931" },
    { id: "hair-color-04", label: "Honey", swatch: "#c58b42" },
    { id: "hair-color-05", label: "Copper", swatch: "#a94c2c" },
    { id: "hair-color-06", label: "Silver", swatch: "#aaaeb8" },
    { id: "hair-color-07", label: "Rose", swatch: "#c75b82" },
    { id: "hair-color-08", label: "Ocean", swatch: "#356b9b" },
  ]),
  eyes: options([
    { id: "eyes-01", label: "Bright" },
    { id: "eyes-02", label: "Soft" },
    { id: "eyes-03", label: "Smiling" },
    { id: "eyes-04", label: "Focused" },
    { id: "eyes-05", label: "Lashes" },
    { id: "eyes-06", label: "Sleepy" },
  ]),
  mouth: options([
    { id: "mouth-01", label: "Smile" },
    { id: "mouth-02", label: "Grin" },
    { id: "mouth-03", label: "Calm" },
    { id: "mouth-04", label: "Cheerful" },
    { id: "mouth-05", label: "Surprised" },
    { id: "mouth-06", label: "Playful" },
  ]),
  outfit: options([
    { id: "outfit-01", label: "Crew neck" },
    { id: "outfit-02", label: "Hoodie" },
    { id: "outfit-03", label: "Collared shirt" },
    { id: "outfit-04", label: "Sweater" },
    { id: "outfit-05", label: "Jacket" },
    { id: "outfit-06", label: "V neck" },
    { id: "outfit-07", label: "Turtleneck" },
    { id: "outfit-08", label: "Overalls" },
    { id: "outfit-09", label: "Sport top" },
    { id: "outfit-10", label: "Blazer" },
  ]),
  outfitColor: options([
    { id: "outfit-color-01", label: "Mint", swatch: "#1fb879" },
    { id: "outfit-color-02", label: "Forest", swatch: "#19714c" },
    { id: "outfit-color-03", label: "Sky", swatch: "#5199d7" },
    { id: "outfit-color-04", label: "Navy", swatch: "#3c527c" },
    { id: "outfit-color-05", label: "Coral", swatch: "#e46f63" },
    { id: "outfit-color-06", label: "Plum", swatch: "#865e91" },
    { id: "outfit-color-07", label: "Ochre", swatch: "#cf9638" },
    { id: "outfit-color-08", label: "Graphite", swatch: "#555d62" },
  ]),
  accessory: options([
    { id: "accessory-none", label: "None" },
    { id: "accessory-01", label: "Round glasses" },
    { id: "accessory-02", label: "Square glasses" },
    { id: "accessory-03", label: "Sunglasses" },
    { id: "accessory-04", label: "Freckles" },
    { id: "accessory-05", label: "Earrings" },
    { id: "accessory-06", label: "Headphones" },
    { id: "accessory-07", label: "Cap" },
    { id: "accessory-08", label: "Hair clip" },
  ]),
  background: options([
    { id: "background-01", label: "Mint", swatch: "#d9f6e7" },
    { id: "background-02", label: "Sky", swatch: "#dceeff" },
    { id: "background-03", label: "Peach", swatch: "#ffe3d9" },
    { id: "background-04", label: "Lavender", swatch: "#e9e1ff" },
    { id: "background-05", label: "Butter", swatch: "#fff1bf" },
    { id: "background-06", label: "Rose", swatch: "#ffe0ea" },
    { id: "background-07", label: "Stone", swatch: "#e8eceb" },
    { id: "background-08", label: "Night", swatch: "#31415c" },
  ]),
  eyebrows: options([{id:"brows-01",label:"Natural"},{id:"brows-02",label:"Straight"},{id:"brows-03",label:"Arched"},{id:"brows-04",label:"Bold"}]),
  nose: options([{id:"nose-01",label:"Soft"},{id:"nose-02",label:"Round"},{id:"nose-03",label:"Defined"}]),
  bottom: options([{id:"bottom-01",label:"Straight trousers"},{id:"bottom-02",label:"Wide trousers"},{id:"bottom-03",label:"Shorts"},{id:"bottom-04",label:"Pleated skirt"},{id:"bottom-05",label:"Long skirt"},{id:"bottom-06",label:"Joggers"}]),
  bottomColor: options([{id:"bottom-color-01",label:"Denim",swatch:"#426488"},{id:"bottom-color-02",label:"Charcoal",swatch:"#39434e"},{id:"bottom-color-03",label:"Cream",swatch:"#e8d9bd"},{id:"bottom-color-04",label:"Sage",swatch:"#7b9579"},{id:"bottom-color-05",label:"Rose",swatch:"#c88595"},{id:"bottom-color-06",label:"Cocoa",swatch:"#916957"}]),
  socks: options([{id:"socks-01",label:"Ankle socks"},{id:"socks-02",label:"Crew socks"},{id:"socks-03",label:"Striped socks"}]),
  shoes: options([{id:"shoes-01",label:"Sneakers"},{id:"shoes-02",label:"High tops"},{id:"shoes-03",label:"Loafers"},{id:"shoes-04",label:"Boots"},{id:"shoes-05",label:"Mary Janes"}]),
  shoeColor: options([{id:"shoe-color-01",label:"Ivory",swatch:"#f0eadf"},{id:"shoe-color-02",label:"Ink",swatch:"#343e49"},{id:"shoe-color-03",label:"Cherry",swatch:"#b85857"},{id:"shoe-color-04",label:"Ocean",swatch:"#638cb4"},{id:"shoe-color-05",label:"Honey",swatch:"#b8894e"},{id:"shoe-color-06",label:"Lilac",swatch:"#a899c7"}]),
  headwear: options([{id:"headwear-none",label:"None"},{id:"headwear-01",label:"Beanie"},{id:"headwear-02",label:"Beret"},{id:"headwear-03",label:"Bucket hat"}]),
  bag: options([{id:"bag-none",label:"None"},{id:"bag-01",label:"Crossbody"},{id:"bag-02",label:"Tote"},{id:"bag-03",label:"Backpack"}]),
} as const satisfies Record<AvatarCategory, readonly AvatarOption[]>;

export const AVATAR_CATEGORY_KEYS = Object.freeze([
  "skinTone",
  "face",
  "hair",
  "hairColor",
  "eyes",
  "mouth",
  "outfit",
  "outfitColor",
  "accessory",
  "background",
  "eyebrows", "nose", "bottom", "bottomColor", "socks", "shoes", "shoeColor", "headwear", "bag",
] as const satisfies readonly AvatarCategory[]);

const CATEGORY_LABELS: Record<AvatarCategory, string> = {
  skinTone: "Skin tone",
  face: "Face",
  hair: "Hair",
  hairColor: "Hair colour",
  eyes: "Eyes",
  mouth: "Expression",
  outfit: "Outfit",
  outfitColor: "Outfit colour",
  accessory: "Accessory",
  background: "Background",
  eyebrows: "Eyebrows", nose: "Nose", bottom: "Bottoms", bottomColor: "Bottom colour", socks: "Socks", shoes: "Shoes", shoeColor: "Shoe colour", headwear: "Headwear", bag: "Bag",
};

/** UI-friendly ordered catalogue shared by web and native clients. */
export const AVATAR_CATEGORIES = Object.freeze(
  AVATAR_CATEGORY_KEYS.map((key) => Object.freeze({ key, label: CATEGORY_LABELS[key], options: AVATAR_CATALOG[key] })),
);

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = Object.freeze({
  version: 2,
  skinTone: "skin-02",
  face: "face-01",
  hair: "hair-03",
  hairColor: "hair-color-02",
  eyes: "eyes-01",
  mouth: "mouth-01",
  outfit: "outfit-01",
  outfitColor: "outfit-color-01",
  accessory: "accessory-none",
  background: "background-01",
  eyebrows: "brows-01", nose: "nose-01", bottom: "bottom-01", bottomColor: "bottom-color-01", socks: "socks-01", shoes: "shoes-01", shoeColor: "shoe-color-01", headwear: "headwear-none", bag: "bag-none",
});

const optionIds = Object.fromEntries(
  AVATAR_CATEGORY_KEYS.map((category) => [category, new Set(AVATAR_CATALOG[category].map((item) => item.id))]),
) as unknown as Record<AvatarCategory, ReadonlySet<string>>;

/** Converts untrusted persisted/API data to the exact current avatar contract. */
export function normalizeAvatarConfig(value: unknown): AvatarConfig {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const normalized = { ...DEFAULT_AVATAR_CONFIG } as Record<string, string | number>;
  for (const category of AVATAR_CATEGORY_KEYS) {
    const candidate = source[category];
    if (typeof candidate === "string" && optionIds[category].has(candidate)) normalized[category] = candidate;
  }
  normalized.version = 2;
  return normalized as AvatarConfig;
}

export function normalizeAvatarMode(value: unknown): AvatarMode {
  return value === "character" ? "character" : "photo";
}

function seededUnit(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function numberSeed(seed: number | string): number {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Same seed always produces the same complete, valid character. */
export function randomAvatarConfig(seed: number | string = Date.now()): AvatarConfig {
  const random = seededUnit(numberSeed(seed));
  const result = { ...DEFAULT_AVATAR_CONFIG } as Record<string, string | number>;
  for (const category of AVATAR_CATEGORY_KEYS) {
    const choices = AVATAR_CATALOG[category];
    result[category] = choices[Math.floor(random() * choices.length)]!.id;
  }
  result.version = 2;
  return result as AvatarConfig;
}

/** Human-readable option list; pass translated names when used in localized UI. */
export function avatarSummary(
  value: unknown,
  labels: Partial<Record<string, string>> = {},
): string {
  const config = normalizeAvatarConfig(value);
  return AVATAR_CATEGORY_KEYS
    .filter((category) => category !== "hairColor" && category !== "outfitColor")
    .map((category) => labels[config[category]] || AVATAR_CATALOG[category].find((item) => item.id === config[category])?.label || config[category])
    .join(", ");
}

const SKIN: Record<AvatarConfig["skinTone"], string> = {
  "skin-01": "#f8d9c5", "skin-02": "#efc29f", "skin-03": "#d99b69",
  "skin-04": "#b96f47", "skin-05": "#865037", "skin-06": "#583426",
};
const HAIR: Record<AvatarConfig["hairColor"], string> = {
  "hair-color-01": "#252428", "hair-color-02": "#493127", "hair-color-03": "#7a4931", "hair-color-04": "#c58b42",
  "hair-color-05": "#a94c2c", "hair-color-06": "#aaaeb8", "hair-color-07": "#c75b82", "hair-color-08": "#356b9b",
};
const OUTFIT: Record<AvatarConfig["outfitColor"], string> = {
  "outfit-color-01": "#1fb879", "outfit-color-02": "#19714c", "outfit-color-03": "#5199d7", "outfit-color-04": "#3c527c",
  "outfit-color-05": "#e46f63", "outfit-color-06": "#865e91", "outfit-color-07": "#cf9638", "outfit-color-08": "#555d62",
};
const BACKGROUND: Record<AvatarConfig["background"], string> = {
  "background-01": "#d9f6e7", "background-02": "#dceeff", "background-03": "#ffe3d9", "background-04": "#e9e1ff",
  "background-05": "#fff1bf", "background-06": "#ffe0ea", "background-07": "#e8eceb", "background-08": "#31415c",
};

const FACE_SHAPES: Record<AvatarConfig["face"], string> = {
  "face-01": '<ellipse cx="64" cy="61" rx="27" ry="31"/>',
  "face-02": '<path d="M37 54c0-19 11-29 27-29s27 10 27 29c0 23-12 39-27 39S37 77 37 54Z"/>',
  "face-03": '<ellipse cx="64" cy="60" rx="24" ry="34"/>',
  "face-04": '<path d="M38 50c2-17 12-25 26-25s24 8 26 25l-4 27-22 17-22-17-4-27Z"/>',
};

function hairShape(id: AvatarConfig["hair"], colour: string): string {
  const fill = `fill="${colour}"`;
  const shapes: Record<AvatarConfig["hair"], string> = {
    "hair-01": `<path ${fill} d="M38 53c-4-20 8-34 27-34 17 0 29 11 27 31-8-2-16-8-20-15-8 9-20 14-34 18Z"/>`,
    "hair-02": `<path ${fill} d="M37 56c-4-24 9-37 29-37 18 0 29 13 26 34-6-12-15-20-28-22-3 10-14 19-27 25Z"/>`,
    "hair-03": `<path ${fill} d="M34 59c-5-22 5-40 29-41 23-1 35 16 31 41l-7-9-6 5-7-13-9 8-9-10-10 14-12 5Z"/>`,
    "hair-04": `<path ${fill} d="M34 57c-4-26 8-39 30-39s34 15 30 40l3 40-18-5 7-42c-13-5-20-13-23-19-5 10-12 17-23 21l8 40-18 5 4-41Z"/>`,
    "hair-05": `<path ${fill} d="M34 56c-3-24 9-38 30-38s33 14 30 38l-2 31-15 5 8-42c-10-4-17-10-22-18-5 9-12 15-22 19l8 41-15-5V56Z"/>`,
    "hair-06": `<circle ${fill} cx="64" cy="17" r="13"/><path ${fill} d="M36 55c-4-23 8-37 28-37 21 0 33 15 28 38-8-6-15-14-19-23-8 11-20 19-37 22Z"/>`,
    "hair-07": `<g ${fill}><circle cx="41" cy="35" r="13"/><circle cx="55" cy="25" r="14"/><circle cx="72" cy="25" r="14"/><circle cx="87" cy="37" r="13"/><circle cx="91" cy="54" r="10"/><circle cx="36" cy="53" r="10"/></g>`,
    "hair-08": `<path ${fill} d="M38 48c0-19 10-29 26-29s26 10 26 29c-7-8-15-12-26-12s-19 4-26 12Z"/>`,
    "hair-09": `<path ${fill} d="M37 54c-3-23 9-36 27-36s30 13 27 36c-11-4-20-12-27-22-7 10-16 18-27 22Z"/><g stroke="${colour}" stroke-width="7" stroke-linecap="round"><path d="M42 45l-9 45"/><path d="M86 45l9 45"/></g>`,
    "hair-10": `<ellipse ${fill} cx="95" cy="51" rx="13" ry="25"/><path ${fill} d="M36 55c-3-24 9-37 28-37s31 14 28 37c-12-5-21-13-28-23-7 10-16 18-28 23Z"/>`,
    "hair-11": `<ellipse ${fill} cx="64" cy="38" rx="36" ry="29"/>`,
    "hair-12": `<path ${fill} d="M31 62c0-31 13-46 33-46s33 15 33 46l-7 31H38l-7-31Z"/><path fill="#ffffff" fill-opacity=".2" d="M40 45c8-13 16-18 25-18 10 0 18 5 25 18-13-6-37-6-50 0Z"/>`,
  };
  return shapes[id];
}

const EYES: Record<AvatarConfig["eyes"], string> = {
  "eyes-01": '<g fill="#2a2424"><circle cx="53" cy="60" r="3.2"/><circle cx="75" cy="60" r="3.2"/></g><g fill="#fff"><circle cx="52" cy="59" r="1"/><circle cx="74" cy="59" r="1"/></g>',
  "eyes-02": '<g fill="none" stroke="#2a2424" stroke-width="3" stroke-linecap="round"><path d="M48 60q5-5 10 0"/><path d="M70 60q5-5 10 0"/></g>',
  "eyes-03": '<g fill="none" stroke="#2a2424" stroke-width="3" stroke-linecap="round"><path d="M48 61q5 5 10 0"/><path d="M70 61q5 5 10 0"/></g>',
  "eyes-04": '<g fill="#2a2424"><ellipse cx="53" cy="60" rx="2.4" ry="3.8"/><ellipse cx="75" cy="60" rx="2.4" ry="3.8"/></g>',
  "eyes-05": '<g fill="none" stroke="#2a2424" stroke-width="2.8" stroke-linecap="round"><path d="M48 61q5-6 10 0m-9-3-2-2m11 2 2-2"/><path d="M70 61q5-6 10 0m-9-3-2-2m11 2 2-2"/></g>',
  "eyes-06": '<g fill="none" stroke="#2a2424" stroke-width="3" stroke-linecap="round"><path d="M48 61h10"/><path d="M70 61h10"/></g>',
};

const MOUTHS: Record<AvatarConfig["mouth"], string> = {
  "mouth-01": '<path d="M56 75q8 8 16 0" fill="none" stroke="#8f3f42" stroke-width="2.6" stroke-linecap="round"/>',
  "mouth-02": '<path d="M54 74q10 12 20 0Z" fill="#fff" stroke="#8f3f42" stroke-width="2"/>',
  "mouth-03": '<path d="M58 77h12" fill="none" stroke="#8f3f42" stroke-width="2.5" stroke-linecap="round"/>',
  "mouth-04": '<path d="M54 73q10 14 20 0" fill="#9c4650"/><path d="M58 76h12" stroke="#fff" stroke-width="2"/>',
  "mouth-05": '<ellipse cx="64" cy="77" rx="4.5" ry="6" fill="#8f3f42"/>',
  "mouth-06": '<path d="M55 75q9 8 18 0" fill="none" stroke="#8f3f42" stroke-width="2.5" stroke-linecap="round"/><path d="M67 80q4 5 7-2" fill="#dc7180"/>',
};

function outfitShape(id: AvatarConfig["outfit"], colour: string): string {
  const base = `<path fill="${colour}" d="M21 128c2-27 18-39 43-39s41 12 43 39H21Z"/>`;
  const details: Record<AvatarConfig["outfit"], string> = {
    "outfit-01": '<path d="M51 92q13 16 26 0" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="5"/>',
    "outfit-02": '<path d="M43 96q21 19 42 0M48 103l-2 17m34-17 2 17" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3"/>',
    "outfit-03": '<path d="M48 91l16 16 16-16-5 28H53l-5-28Z" fill="#fff" fill-opacity=".8"/>',
    "outfit-04": '<path d="M28 113h72M31 121h66" stroke="#fff" stroke-opacity=".25" stroke-width="4"/>',
    "outfit-05": '<path d="M50 91l14 35 14-35m-14 16v21" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>',
    "outfit-06": '<path d="M48 91l16 19 16-19" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5"/>',
    "outfit-07": '<path d="M50 90h28v18H50Z" fill="#fff" fill-opacity=".25"/>',
    "outfit-08": '<path d="M44 92l8 36m32-36-8 36M50 110h28" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5"/>',
    "outfit-09": '<path d="M26 113h76" stroke="#fff" stroke-opacity=".4" stroke-width="7"/>',
    "outfit-10": '<path d="M45 92l12 18-7 18m33-36-12 18 7 18" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="4"/>',
  };
  return base + details[id];
}

function accessoryShape(id: AvatarConfig["accessory"]): string {
  const shapes: Record<AvatarConfig["accessory"], string> = {
    "accessory-none": "",
    "accessory-01": '<g fill="none" stroke="#3c4653" stroke-width="2.5"><circle cx="53" cy="61" r="8"/><circle cx="75" cy="61" r="8"/><path d="M61 61h6"/></g>',
    "accessory-02": '<g fill="none" stroke="#3c4653" stroke-width="2.5"><rect x="45" y="53" width="16" height="15" rx="3"/><rect x="67" y="53" width="16" height="15" rx="3"/><path d="M61 60h6"/></g>',
    "accessory-03": '<g fill="#26323d"><path d="M44 54h18v12q-9 7-18 0Z"/><path d="M66 54h18v12q-9 7-18 0Z"/><path d="M60 58h8v3h-8Z"/></g>',
    "accessory-04": '<g fill="#9e5f48" opacity=".7"><circle cx="48" cy="69" r="1"/><circle cx="53" cy="71" r="1"/><circle cx="58" cy="69" r="1"/><circle cx="70" cy="69" r="1"/><circle cx="75" cy="71" r="1"/><circle cx="80" cy="69" r="1"/></g>',
    "accessory-05": '<g fill="#f2bf35"><circle cx="37" cy="70" r="3"/><circle cx="91" cy="70" r="3"/></g>',
    "accessory-06": '<g fill="none" stroke="#475464" stroke-width="5"><path d="M34 62v-7q0-29 30-29t30 29v7"/><path d="M32 60v18m64-18v18"/></g>',
    "accessory-07": '<path fill="#37996b" d="M34 36q10-24 33-21 19 2 27 19-33-7-60 2Z"/><path fill="#247c55" d="M58 32q28-3 42 6-28 4-42-6Z"/>',
    "accessory-08": '<path fill="#f1b92d" d="M86 39l4 5 6-2-3 6 4 5-7-1-4 5-1-7-6-3 6-2 1-6Z"/>',
  };
  return shapes[id];
}

function avatarHead(config: AvatarConfig): string {
  const skin = SKIN[config.skinTone];
  const brows = {
    "brows-01": "M48 53q5-3 10 0m12 0q5-3 10 0",
    "brows-02": "M48 53h10m12 0h10",
    "brows-03": "M48 53l5-4 5 2m12 0 5-2 5 4",
    "brows-04": "M48 52l10 1m12 0 10-1",
  }[config.eyebrows];
  const nose = {
    "nose-01": '<path d="M63 62l-2 8h5"/>',
    "nose-02": '<path d="M61 67q-3 5 3 5t3-5"/>',
    "nose-03": '<path d="M64 62l-4 9 7 1"/>',
  }[config.nose];
  const hats = {
    "headwear-none": "",
    "headwear-01": '<path fill="#c77c63" d="M31 39Q29 5 64 5t33 34Z"/><rect x="29" y="30" width="70" height="13" rx="5" fill="#df997e"/><path d="M42 31V20m12 11V15m12 16V14m12 17V18m12 13V24" stroke="#a66353" stroke-width="2"/>',
    "headwear-02": '<path fill="#698470" d="M30 32Q20 12 56 9t43 17L86 37H37Z"/><path d="M63 10l3-6" stroke="#465e4c" stroke-width="4"/><path d="M36 34h52" stroke="#465e4c" stroke-width="6"/>',
    "headwear-03": '<path fill="#e3c594" d="M40 11h47l6 26H33Z"/><path fill="#c9ab7b" d="M32 32h63l12 14q-43 8-86 0Z"/><path d="M38 29h51" stroke="#ac8e62" stroke-width="3"/>',
  }[config.headwear];
  // Covered hair frames the face instead of painting over it.
  const hair = config.hair === "hair-12"
    ? `<path fill="${HAIR[config.hairColor]}" fill-rule="evenodd" d="M31 62c0-31 13-46 33-46s33 15 33 46l-7 36H38ZM42 53c0-18 44-18 44 0v15c0 32-44 32-44 0Z"/>`
    : hairShape(config.hair, HAIR[config.hairColor]);
  return `${FACE_SHAPES[config.face].replace("/>", ` fill="${skin}"/>`)}<g fill="${skin}"><ellipse cx="39" cy="64" rx="4" ry="7"/><ellipse cx="89" cy="64" rx="4" ry="7"/></g>${hair}<path d="${brows}" fill="none" stroke="${HAIR[config.hairColor]}" stroke-width="${config.eyebrows === "brows-04" ? 3.4 : 2}" stroke-linecap="round"/>${EYES[config.eyes]}<g fill="none" stroke="#7e4c3d" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round">${nose}</g>${MOUTHS[config.mouth]}${accessoryShape(config.accessory === "accessory-07" && config.headwear !== "headwear-none" ? "accessory-none" : config.accessory)}${hats}`;
}

/** Returns deterministic portrait markup; compact identity icons stay face-first. */
export function renderAvatarSvg(value: unknown): string {
  const config = normalizeAvatarConfig(value);
  const skin = SKIN[config.skinTone];
  const outfit = OUTFIT[config.outfitColor];
  const background = BACKGROUND[config.background];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="${background}"/><circle cx="104" cy="24" r="16" fill="#fff" fill-opacity=".2"/>${outfitShape(config.outfit, outfit)}<rect x="57" y="82" width="14" height="19" rx="7" fill="${skin}"/>${avatarHead(config)}</svg>`;
}

export function avatarDataUri(value: unknown): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(renderAvatarSvg(value))}`;
}

export const AVATAR_GROUPS = [
  { key: "face", categories: ["skinTone", "face", "eyebrows", "eyes", "nose", "mouth"] },
  { key: "hair", categories: ["hair", "hairColor"] },
  { key: "clothes", categories: ["outfit", "outfitColor", "bottom", "bottomColor"] },
  { key: "feet", categories: ["socks", "shoes", "shoeColor"] },
  { key: "extras", categories: ["accessory", "headwear", "bag", "background"] },
] as const satisfies readonly {key: string; categories: readonly AvatarCategory[]}[];

/** Original layered vector character: no uploaded SVG, external URLs, or executable markup. */
export function renderFullBodyAvatarSvg(value: unknown, transparent = false): string {
  const c = normalizeAvatarConfig(value);
  const skin = SKIN[c.skinTone];
  const top = OUTFIT[c.outfitColor];
  const bottom = AVATAR_CATALOG.bottomColor.find((item) => item.id === c.bottomColor)!.swatch;
  const shoe = AVATAR_CATALOG.shoeColor.find((item) => item.id === c.shoeColor)!.swatch;
  const trousers = {
    "bottom-01": 'M68 176h56l-4 73h-20l-4-52-4 52H72Z',
    "bottom-02": 'M68 176h56l6 73h-29l-5-51-5 51H62Z',
    "bottom-03": 'M68 176h56l2 36h-27l-3-17-3 17H66Z',
    "bottom-04": 'M70 176h52l16 45H54Z',
    "bottom-05": 'M70 176h52l13 70H57Z',
    "bottom-06": 'M66 176h60l-4 56-6 17h-15l-5-48-5 48H76l-6-17Z',
  }[c.bottom];
  const sleeves = ["outfit-01", "outfit-06", "outfit-09"].includes(c.outfit) ? "" : `<g fill="${top}" stroke="none"><path d="M55 147l14 4-5 35-14-3Z"/><path d="M123 151l14-4 5 36-14 3Z"/></g><path d="M51 180l13 3m64 0 13-3" stroke="#fff" stroke-opacity=".25" stroke-width="3"/>`;
  const topDetails = sleeves + '<g fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.5" stroke-linejoin="round">' + ({
    "outfit-01": '<path d="M82 108q14 16 28 0"/>',
    "outfit-02": '<path d="M76 110q20 28 40 0m-32 10-2 22m26-22 2 22M82 153h28l5 15H77Z"/>',
    "outfit-03": '<path d="M81 106l15 15 15-15m-15 15v62M79 134h10v11H79"/><g fill="#fff" stroke="none"><circle cx="100" cy="132" r="1.5"/><circle cx="100" cy="147" r="1.5"/><circle cx="100" cy="162" r="1.5"/></g>',
    "outfit-04": '<path d="M73 147h46m-46 10h46m-46 10h46M82 108q14 16 28 0"/>',
    "outfit-05": '<path d="M81 106l15 21 15-21m-15 21v56M76 151h12m16 0h12"/>',
    "outfit-06": '<path d="M81 108l15 23 15-23" stroke-width="5"/>',
    "outfit-07": '<path d="M83 105h26v13H83Z" fill="#fff" fill-opacity=".2"/>',
    "outfit-08": '<path d="M78 108v46h36v-46m-41 32h46v40H73Z" fill="#fff" fill-opacity=".15"/>',
    "outfit-09": '<path d="M71 145h50" stroke-width="10"/><path d="M96 123v10"/>',
    "outfit-10": '<path d="M79 108l7 13-7 10 17 24 17-24-7-10 7-13m-17 46v29M76 161h11m18 0h11"/>',
  }[c.outfit]) + '</g>';
  const sockY = c.socks === "socks-01" ? 247 : 231;
  const socks = `<g fill="#f9f2e8"><path d="M74 ${sockY}h17V263H74Z"/><path d="M101 ${sockY}h17V263h-17Z"/></g>${c.socks === "socks-03" ? '<path d="M74 236h17m10 0h17m-44 6h17m10 0h17" stroke="#6e8d83" stroke-width="3"/>' : ''}`;
  const shoes = [0, 28].map((offset) => {
    const high = c.shoes === "shoes-04" ? 239 : c.shoes === "shoes-02" ? 247 : 256;
    return `<g transform="translate(${offset} 0)"><path d="M74 ${high}h17V265q0 7-7 7H65v-6q0-6 9-6Z" fill="${shoe}" stroke="#35413e" stroke-opacity=".3" stroke-width="1.5"/>${c.shoes === "shoes-01" || c.shoes === "shoes-02" ? '<path d="M76 258h9m-12 4h11M65 270h25" stroke="#fff" stroke-width="2.5"/>' : c.shoes === "shoes-05" ? `<path d="M76 256h12v7H75Z" fill="${skin}"/><path d="M80 256v8" stroke="${shoe}" stroke-width="3"/>` : c.shoes === "shoes-03" ? '<path d="M72 264h16" stroke="#d2ba82" stroke-width="3"/>' : '<path d="M77 243h10m-10 5h10" stroke="#e0cfb0" stroke-width="2"/>'}</g>`;
  }).join("");
  const bags = {
    "bag-none": "",
    "bag-01": '<path d="M74 109l51 77" stroke="#7a5346" stroke-width="5"/><rect x="108" y="170" width="30" height="27" rx="7" fill="#b88163"/><path d="M112 178h22" stroke="#e4bc90" stroke-width="2"/><circle cx="123" cy="183" r="2" fill="#f0d09c"/>',
    "bag-02": '<path d="M133 186v-17q10-14 20 0v17" fill="none" stroke="#b79b78" stroke-width="4"/><path d="M128 181h29l3 40h-35Z" fill="#e2caa4"/><path d="M136 193h14v15h-14Z" fill="#8caa8e"/>',
    "bag-03": '<path d="M73 111q-7 17 0 39m46-39q7 17 0 39" fill="none" stroke="#cba16e" stroke-width="7"/><path d="M73 143h46" stroke="#a97b50" stroke-width="3"/>',
  }[c.bag];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 288">${transparent ? "" : `<rect width="192" height="288" rx="28" fill="${BACKGROUND[c.background]}"/><circle cx="151" cy="47" r="23" fill="#fff" fill-opacity=".25"/>`}<ellipse cx="96" cy="275" rx="42" ry="7" fill="#243e35" fill-opacity=".13"/>${c.bag === "bag-03" ? '<rect x="59" y="114" width="74" height="69" rx="18" fill="#ae7c50"/>' : ''}<g fill="${skin}"><rect x="74" y="187" width="17" height="75" rx="8"/><rect x="101" y="187" width="17" height="75" rx="8"/><path d="M58 123h15l-8 61q-1 15-12 9-5-3-2-13Z"/><path d="M119 123h15l7 57q3 10-2 13-11 6-12-9Z"/><rect x="87" y="87" width="18" height="28" rx="8"/></g>${socks}<path d="${trousers}" fill="${bottom}"/><path d="M72 183h48M96 183v14" stroke="#fff" stroke-opacity=".22" stroke-width="2"/>${c.bottom === "bottom-04" ? '<path d="M76 188l-7 28m18-28-2 28m18-28 2 28m10-28 7 28" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>' : ''}${shoes}<path d="M81 105q15 10 30 0l18 10 10 38-15 5-5-19 3 43H70l3-43-5 19-15-5 10-38Z" fill="${top}"/><g fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.5" stroke-linejoin="round">${topDetails}</g>${bags}<g transform="translate(32 4)">${avatarHead(c)}</g></svg>`;
}

export type AvatarPreview = "full" | "face" | "top" | "bottom" | "feet";
export function avatarPreviewForCategory(category: AvatarCategory): AvatarPreview {
  if (["bottom", "bottomColor"].includes(category)) return "bottom";
  if (["socks", "shoes", "shoeColor"].includes(category)) return "feet";
  if (["outfit", "outfitColor", "bag"].includes(category)) return "top";
  return category === "background" ? "full" : "face";
}
export function renderAvatarPreviewSvg(value: unknown, view: AvatarPreview = "full"): string {
  if (view === "face") return renderAvatarSvg(value);
  const boxes = {full:"0 0 192 288", top:"44 100 116 116", bottom:"48 169 96 108", feet:"57 221 79 59"};
  return renderFullBodyAvatarSvg(value).replace('viewBox="0 0 192 288"', `viewBox="${boxes[view] || boxes.full}"`);
}
export function avatarPreviewDataUri(value: unknown, view: AvatarPreview = "full"): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(renderAvatarPreviewSvg(value, view))}`;
}
