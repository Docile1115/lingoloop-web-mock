/**
 * 요청 값 검증 규칙.
 *
 * server.mjs 는 불러오는 순간 Firebase 에 붙고 포트를 열어서 테스트가 그대로 불러올 수
 * 없습니다. 그래서 규칙은 이 파일에 두고, 오류 응답은 server.mjs 가 자기 ApiError 를
 * 넘겨 만듭니다(createValidators). homes.mjs 가 ApiError 를 넘겨받는 것과 같은 방식입니다.
 */

/**
 * Firestore 문서 ID.
 *
 * Express 5 는 경로 값의 %2F 를 "/" 로 풀어 줍니다. 그 값이 그대로 .doc() 에 들어가면
 * "p1/replies/r1" 처럼 다른 문서를 가리키거나, 경로 짝이 맞지 않아 500 이 납니다.
 * 서버가 만드는 ID(uid, post-<uuid>, reply-<uuid>, conversation-<hex>, 알림·방명록 sha256 hex,
 * frame2 …)는 모두 영문·숫자·_·- 라서 그 밖의 글자는 받지 않습니다.
 * __이름__ 꼴은 Firestore 가 예약해 둔 ID 라 서버가 거절합니다(500).
 */
const DOCUMENT_ID = /^[A-Za-z0-9_-]+$/;
const RESERVED_DOCUMENT_ID = /^__.*__$/;

export function isDocumentId(value, { min = 4, max = 128 } = {}) {
  return (
    typeof value === "string" &&
    value.length >= min &&
    value.length <= max &&
    DOCUMENT_ID.test(value) &&
    !RESERVED_DOCUMENT_ID.test(value)
  );
}

/**
 * 글·메시지에 붙는 사진·음성.
 *
 * 화면이 <img>·<audio> 로 그대로 그리므로 외부 주소를 받으면 그 글을 본 모든 사람의
 * IP 와 읽은 시각이 그 서버에 남습니다. 기기에서 만든 데이터 URI 만 받습니다.
 * 사진은 프로필 사진(avatarUrlFrom)과 같은 규칙입니다.
 *
 * 음성은 클라이언트가 실제로 만드는 형식만 받습니다.
 * - 웹 녹음기(MediaRecorder): audio/webm;codecs=opus(크롬), audio/ogg; codecs=opus(파이어폭스),
 *   audio/mp4(사파리)
 * - 앱(expo-audio): audio/mp4(iOS), audio/3gpp(안드로이드), audio/webm(웹)
 * - aac·x-m4a 는 iOS 녹음 파일에 붙는 같은 형식의 다른 이름입니다.
 */
export const MEDIA_MAX_LENGTH = 520000;
const IMAGE_DATA_URI = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const AUDIO_DATA_URI =
  /^data:audio\/(?:webm|ogg|mp4|x-m4a|aac|3gpp)(?:; ?codecs="?[A-Za-z0-9.,+ -]{1,64}"?)?;base64,[A-Za-z0-9+/]+={0,2}$/;

export function isMediaDataUri(value, kind) {
  const pattern = kind === "image" ? IMAGE_DATA_URI : kind === "audio" ? AUDIO_DATA_URI : null;
  return Boolean(pattern) && typeof value === "string" && value.length <= MEDIA_MAX_LENGTH && pattern.test(value);
}

/**
 * 메시지 폴링의 ?after= 값. 서버가 저장하는 sentAt(toISOString) 과 같은 꼴만 받습니다.
 * sentAt 은 문자열로 비교하므로 밀리초 자릿수가 다른 값("…:56Z")은 저장 형식("…:56.000Z")으로
 * 맞춥니다 — 그대로 비교하면 같은 초의 메시지를 건너뜁니다. 쿼리 문자열의 "+" 는 공백으로
 * 풀리므로 시간대 오프셋(+09:00)은 받지 않습니다.
 */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function normalizedIsoTimestamp(value) {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) return null;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return null;
  const normalized = new Date(millis).toISOString();
  // 2026-02-30 처럼 달력에 없는 날짜는 다른 날로 넘어가므로 받지 않습니다.
  return normalized.slice(0, 19) === value.slice(0, 19) ? normalized : null;
}

/** server.mjs 의 ApiError 로 422 를 만드는 검증 함수들입니다. */
export function createValidators(ApiError) {
  const invalid = (field, message) => new ApiError(422, "VALIDATION_ERROR", message || field + " 형식을 확인해 주세요.", { field });

  function docId(value, field, options) {
    if (!isDocumentId(value, options)) throw invalid(field);
    return value;
  }

  return {
    docId,

    /** 비어 있으면(undefined·null·"") "" 이고, 있으면 docId 와 같은 규칙입니다. */
    optionalDocId(value, field, options) {
      if (value === undefined || value === null || value === "") return "";
      return docId(value, field, options);
    },

    /** 첨부는 비우면 "" 입니다. kind 는 "image" 또는 "audio" 입니다. */
    mediaDataUri(value, field, kind) {
      if (value === undefined || value === null) return "";
      if (typeof value !== "string") throw invalid(field, field + " 필드는 문자열이어야 합니다.");
      const media = value.trim();
      if (!media) return "";
      if (media.length > MEDIA_MAX_LENGTH) {
        throw new ApiError(422, "VALIDATION_ERROR", field + " 필드는 " + MEDIA_MAX_LENGTH + "자 이하여야 합니다.", {
          field,
          max: MEDIA_MAX_LENGTH,
        });
      }
      if (!isMediaDataUri(media, kind)) {
        throw invalid(field, kind === "image" ? "사진 형식을 확인해 주세요." : "음성 형식을 확인해 주세요.");
      }
      return media;
    },

    /** ISO 시각(…Z). 저장 형식(toISOString)으로 맞춰 돌려줍니다. */
    isoTimestamp(value, field) {
      const normalized = normalizedIsoTimestamp(value);
      if (!normalized) throw invalid(field, field + " 필드는 ISO 시각(예: 2026-01-31T09:00:00.000Z)이어야 합니다.");
      return normalized;
    },
  };
}
