/**
 * 캐릭터 파츠는 서버가 알고 있는 식별자만 저장합니다.
 *
 * SVG, HTML, data URI, 외부 URL 같은 표시 내용을 프로필 문서에 받지 않습니다.
 * 클라이언트는 이 식별자를 앱에 포함된 검증된 에셋으로만 렌더링합니다.
 */
export const AVATAR_ITEM_IDS = Object.freeze({
  skinTone: Object.freeze(["skin-01", "skin-02", "skin-03", "skin-04", "skin-05", "skin-06"]),
  face: Object.freeze(["face-01", "face-02", "face-03", "face-04"]),
  hair: Object.freeze(Array.from({ length: 12 }, (_, index) => `hair-${String(index + 1).padStart(2, "0")}`)),
  hairColor: Object.freeze(Array.from({ length: 8 }, (_, index) => `hair-color-${String(index + 1).padStart(2, "0")}`)),
  eyes: Object.freeze(Array.from({ length: 6 }, (_, index) => `eyes-${String(index + 1).padStart(2, "0")}`)),
  mouth: Object.freeze(Array.from({ length: 6 }, (_, index) => `mouth-${String(index + 1).padStart(2, "0")}`)),
  outfit: Object.freeze(Array.from({ length: 10 }, (_, index) => `outfit-${String(index + 1).padStart(2, "0")}`)),
  outfitColor: Object.freeze(Array.from({ length: 8 }, (_, index) => `outfit-color-${String(index + 1).padStart(2, "0")}`)),
  accessory: Object.freeze([
    "accessory-none",
    ...Array.from({ length: 8 }, (_, index) => `accessory-${String(index + 1).padStart(2, "0")}`),
  ]),
  background: Object.freeze(Array.from({ length: 8 }, (_, index) => `background-${String(index + 1).padStart(2, "0")}`)),
  eyebrows: Object.freeze(["brows-01", "brows-02", "brows-03", "brows-04"]),
  nose: Object.freeze(["nose-01", "nose-02", "nose-03"]),
  bottom: Object.freeze(["bottom-01", "bottom-02", "bottom-03", "bottom-04", "bottom-05", "bottom-06"]),
  bottomColor: Object.freeze(["bottom-color-01", "bottom-color-02", "bottom-color-03", "bottom-color-04", "bottom-color-05", "bottom-color-06"]),
  socks: Object.freeze(["socks-01", "socks-02", "socks-03"]),
  shoes: Object.freeze(["shoes-01", "shoes-02", "shoes-03", "shoes-04", "shoes-05"]),
  shoeColor: Object.freeze(["shoe-color-01", "shoe-color-02", "shoe-color-03", "shoe-color-04", "shoe-color-05", "shoe-color-06"]),
  headwear: Object.freeze(["headwear-none", "headwear-01", "headwear-02", "headwear-03"]),
  bag: Object.freeze(["bag-none", "bag-01", "bag-02", "bag-03"]),
});

export const AVATAR_BODY_DEFAULTS = Object.freeze({ eyebrows:"brows-01", nose:"nose-01", bottom:"bottom-01", bottomColor:"bottom-color-01", socks:"socks-01", shoes:"shoes-01", shoeColor:"shoe-color-01", headwear:"headwear-none", bag:"bag-none" });
export const AVATAR_LEGACY_KEYS = Object.freeze(["version", ...Object.keys(AVATAR_ITEM_IDS).filter(key => !Object.hasOwn(AVATAR_BODY_DEFAULTS, key))]);

export const AVATAR_CONFIG_KEYS = Object.freeze(["version", ...Object.keys(AVATAR_ITEM_IDS)]);
const AVATAR_MODES = new Set(["photo", "character"]);
const AVATAR_ID_SETS = Object.fromEntries(
  Object.entries(AVATAR_ITEM_IDS).map(([field, values]) => [field, new Set(values)]),
);
const AVATAR_PATCH_KEYS = new Set(["mode", "config"]);
const AVATAR_CONFIG_KEY_SET = new Set(AVATAR_CONFIG_KEYS);
const MAX_AVATAR_PATCH_BYTES = 2_048;

export class AvatarValidationError extends Error {
  constructor(message, field = "avatar") {
    super(message);
    this.name = "AvatarValidationError";
    this.field = field;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPayloadSize(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new AvatarValidationError("캐릭터 설정 형식을 확인해 주세요.");
  }
  if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") > MAX_AVATAR_PATCH_BYTES) {
    throw new AvatarValidationError("캐릭터 설정이 너무 큽니다.");
  }
}

function assertExactKeys(value, allowed, required, field) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new AvatarValidationError(`${field}에 지원하지 않는 속성이 있습니다.`, `${field}.${key}`);
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      throw new AvatarValidationError(`${field}.${key} 값이 필요합니다.`, `${field}.${key}`);
    }
  }
}

/** Strict v1/v2 inputs. Legacy faces are upgraded on read, without bulk profile writes. */
export function normalizeAvatarConfig(value) {
  if (!isPlainObject(value)) {
    throw new AvatarValidationError("config는 캐릭터 설정 객체여야 합니다.", "config");
  }
  assertPayloadSize(value);
  if (value.version !== 1 && value.version !== 2) {
    throw new AvatarValidationError("지원하지 않는 캐릭터 설정 버전입니다.", "config.version");
  }
  const legacy = value.version === 1;
  assertExactKeys(value, legacy ? new Set(AVATAR_LEGACY_KEYS) : AVATAR_CONFIG_KEY_SET, legacy ? AVATAR_LEGACY_KEYS : AVATAR_CONFIG_KEYS, "config");
  const normalized = { version: 2 };
  for (const field of Object.keys(AVATAR_ITEM_IDS)) {
    const itemId = legacy && Object.hasOwn(AVATAR_BODY_DEFAULTS, field) ? AVATAR_BODY_DEFAULTS[field] : value[field];
    if (typeof itemId !== "string" || !AVATAR_ID_SETS[field].has(itemId)) {
      throw new AvatarValidationError(`지원하지 않는 ${field} 항목입니다.`, `config.${field}`);
    }
    normalized[field] = itemId;
  }
  return normalized;
}

/** Firestore map의 키 열거 순서와 무관하게 두 설정의 의미가 같은지 비교합니다. */
export function sameAvatarConfig(left, right) {
  if (left === null || right === null) return left === right;
  let normalizedLeft;
  let normalizedRight;
  try {
    normalizedLeft = normalizeAvatarConfig(left);
    normalizedRight = normalizeAvatarConfig(right);
  } catch {
    return false;
  }
  return AVATAR_CONFIG_KEYS.every((key) => normalizedLeft[key] === normalizedRight[key]);
}

/**
 * Firestore의 이전 문서나 손상된 문서를 읽을 때 쓰는 실패 안전 정규화입니다.
 * 유효한 캐릭터 설정이 없으면 사진 모드와 null로 닫힌 상태로 돌아갑니다.
 */
export function avatarFields(profile = {}) {
  const source = isPlainObject(profile) ? profile : {};
  let avatarConfig = null;
  if (source.avatarConfig !== undefined && source.avatarConfig !== null) {
    try {
      avatarConfig = normalizeAvatarConfig(source.avatarConfig);
    } catch {
      return { avatarMode: "photo", avatarConfig: null };
    }
  }
  const requestedMode = AVATAR_MODES.has(source.avatarMode) ? source.avatarMode : "photo";
  return {
    avatarMode: requestedMode === "character" && !avatarConfig ? "photo" : requestedMode,
    avatarConfig,
  };
}

/** PATCH /api/profile/avatar의 엄격한 입력 계약입니다. */
export function normalizeAvatarPatch(payload, currentProfile = {}) {
  if (!isPlainObject(payload)) {
    throw new AvatarValidationError("요청 본문은 객체여야 합니다.");
  }
  assertPayloadSize(payload);
  assertExactKeys(payload, AVATAR_PATCH_KEYS, ["mode"], "avatar");
  if (!AVATAR_MODES.has(payload.mode)) {
    throw new AvatarValidationError("mode는 photo 또는 character여야 합니다.", "mode");
  }

  const hasConfig = Object.hasOwn(payload, "config");
  if (payload.mode === "character" && (!hasConfig || payload.config === null)) {
    throw new AvatarValidationError("캐릭터 모드에는 완전한 config가 필요합니다.", "config");
  }

  let avatarConfig;
  if (!hasConfig) {
    // 사진으로 돌아갈 때 선택값을 보존하면 다시 캐릭터로 바꿀 때 편집을 이어갈 수 있습니다.
    avatarConfig = avatarFields(currentProfile).avatarConfig;
  } else if (payload.config === null) {
    avatarConfig = null;
  } else {
    avatarConfig = normalizeAvatarConfig(payload.config);
    // An older installed client must not erase clothes it cannot edit or display.
    if (payload.config.version === 1) {
      const current = avatarFields(currentProfile).avatarConfig;
      if (current) for (const key of Object.keys(AVATAR_BODY_DEFAULTS)) avatarConfig[key] = current[key];
    }
  }

  return { avatarMode: payload.mode, avatarConfig };
}
