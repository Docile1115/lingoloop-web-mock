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
  };
}
