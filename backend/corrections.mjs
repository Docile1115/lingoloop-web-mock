import { isDocumentId } from "./validate.mjs";

/**
 * 대화 교정. 언어 교환 상대의 메시지를 고쳐 보내면(type: "correction") 고친 문장이 대화에 메시지로
 * 남고, 고침을 받은 사람의 받은 교정함(corrections/{uid}/items/{messageId})에도 같은 transaction 으로
 * 쌓입니다. GET /api/corrections/received 가 내 글에 달린 교정과 합쳐 학습 노트로 보여줍니다.
 *
 * server.mjs 는 불러오는 순간 Firebase 에 붙고 포트를 열어서, 규칙은 이 파일에 두고 오류는
 * server.mjs 가 넘긴 ApiError 로 만듭니다(validate.mjs 의 createValidators 와 같은 방식).
 */

/** 고친 문장은 글 메시지와 같은 길이까지 받습니다. 설명은 한 줄입니다. */
export const CORRECTION_TEXT_MAX = 4000;
export const CORRECTION_NOTE_MAX = 300;
/** 받은 교정 목록이 읽는 대화 교정 수(최신순). */
export const CHAT_CORRECTIONS_LIMIT = 200;

export function createCorrectionRules(ApiError) {
  const invalid = (field, message, extra = {}) => new ApiError(422, "VALIDATION_ERROR", message, { field, ...extra });
  const invalidTarget = (message) => new ApiError(422, "CORRECTION_TARGET_INVALID", message, { field: "targetMessageId" });

  return {
    /**
     * 본문 { text, targetMessageId, note? } 를 확인합니다.
     * text 는 고친 문장이고 글 메시지와 같은 규칙(앞뒤 공백을 빼고 1~4000자)입니다.
     * note 는 비워도 되는 한 줄 설명이라 줄바꿈·겹친 공백을 한 칸으로 줄인 뒤 300자까지 받습니다.
     */
    correctionInput(body) {
      if (typeof body?.text !== "string") throw invalid("text", "text 필드는 문자열이어야 합니다.");
      const text = body.text.trim();
      if (text.length < 1 || text.length > CORRECTION_TEXT_MAX) {
        throw invalid("text", "text 필드는 1자 이상 " + CORRECTION_TEXT_MAX + "자 이하여야 합니다.", {
          min: 1,
          max: CORRECTION_TEXT_MAX,
        });
      }
      // 메시지 id 꼴만 봅니다. 같은 대화에 있는지, 누가 보냈는지는 transaction 에서 확인합니다(readCorrection).
      const targetMessageId = body.targetMessageId;
      if (!isDocumentId(targetMessageId, { min: 1 })) {
        throw invalid("targetMessageId", "targetMessageId 형식을 확인해 주세요.");
      }
      const rawNote = body.note ?? "";
      if (typeof rawNote !== "string") throw invalid("note", "note 필드는 문자열이어야 합니다.");
      const note = rawNote.replace(/\s+/g, " ").trim();
      if (note.length > CORRECTION_NOTE_MAX) {
        throw invalid("note", "note 필드는 " + CORRECTION_NOTE_MAX + "자 이하여야 합니다.", { max: CORRECTION_NOTE_MAX });
      }
      return { text, targetMessageId, note };
    },

    /**
     * createMessage 의 transaction 읽기 단계에서 부릅니다(쓰기보다 먼저).
     *
     * 교정은 수락된 대화에서, 상대가 보낸 글 메시지에만 보냅니다. targetReference 는 같은 대화의
     * messages/{targetMessageId}, inboxReference 는 받는 사람의 교정함에서 이 메시지가 쓸 칸입니다.
     * 원문(original)은 클라이언트 값이 아니라 저장된 대상 메시지에서 복사합니다.
     * 돌려준 필드를 저장할 메시지에 덧붙입니다.
     */
    async readCorrection(transaction, { status, targetReference, inboxReference, recipientId, input }) {
      if (status !== "accepted") {
        throw new ApiError(403, "CORRECTION_NOT_ALLOWED", "수락된 대화에서만 교정을 보낼 수 있습니다.");
      }
      const [targetSnapshot, inboxSnapshot] = await transaction.getAll(targetReference, inboxReference);
      const target = targetSnapshot.exists ? targetSnapshot.data() : null;
      if (!target) throw invalidTarget("고칠 메시지를 찾을 수 없습니다.");
      if (target.senderId !== recipientId) throw invalidTarget("상대가 보낸 메시지만 고칠 수 있습니다.");
      if (target.type !== "text" || typeof target.text !== "string") throw invalidTarget("글 메시지만 고칠 수 있습니다.");
      if (input.text.trim() === target.text.trim()) {
        throw new ApiError(422, "CORRECTION_UNCHANGED", "고친 문장이 원래 문장과 같습니다.", { field: "text" });
      }
      // 메시지 id 는 대화 안에서만 겹치지 않습니다. 다른 대화의 교정이 이미 이 칸을 쓰고 있으면
      // 그 교정을 덮어쓰지 않고 새 id 로 다시 보내게 합니다.
      if (inboxSnapshot.exists) throw new ApiError(409, "MESSAGE_ID_CONFLICT", "이미 사용된 메시지 ID입니다.");
      return { original: target.text, targetMessageId: input.targetMessageId, note: input.note, media: "" };
    },
  };
}

/** 같은 id 로 다시 보낸 교정이 저장된 것과 같은 요청인지. text·type·media 는 createMessage 가 함께 비교합니다. */
export function sameCorrection(existing, input) {
  return existing?.targetMessageId === input.targetMessageId && (existing?.note ?? "") === input.note;
}

/** 받는 사람의 교정함에 남길 항목. 저장한 교정 메시지에서 그대로 옮깁니다(문서 id 는 메시지 id). */
export function correctionInboxEntry(message) {
  return {
    id: message.id,
    source: "chat",
    conversationId: message.conversationId,
    messageId: message.id,
    targetMessageId: message.targetMessageId,
    original: message.original,
    fixed: message.text,
    note: message.note,
    fromUserId: message.senderId,
    createdAt: message.sentAt,
  };
}

/**
 * 교정함 항목 → 받은 교정 한 줄. 내 글에 달린 교정과 같은 모양이라 글 필드(postId·postText)는 비웁니다.
 * author 는 server.mjs 가 만든 작성자 카드(from·fromFlag·fromAvatarUrl·fromAvatarMode·fromAvatarConfig·fromCountryCode)입니다.
 */
export function chatCorrectionRow(entry, author) {
  return {
    id: entry.id,
    source: "chat",
    conversationId: entry.conversationId,
    messageId: entry.messageId,
    targetMessageId: entry.targetMessageId,
    postId: "",
    postText: "",
    original: entry.original,
    fixed: entry.fixed,
    note: entry.note || "",
    createdAt: entry.createdAt,
    fromUserId: entry.fromUserId,
    ...author,
  };
}

/** 내 글에 달린 교정(replies, kind: "correction", postText 를 붙인 것) → 받은 교정 한 줄. 예전 응답의 필드는 그대로입니다. */
export function communityCorrectionRow(reply, author) {
  return {
    id: reply.id,
    source: "community",
    postId: reply.postId,
    postText: reply.postText,
    original: reply.original,
    fixed: reply.text,
    createdAt: reply.createdAt,
    fromUserId: reply.authorId,
    ...author,
  };
}

/** 두 목록을 합쳐 최신순으로 돌려줍니다. 어느 쪽이든 나와 차단 관계(blocked)인 사람의 교정은 뺍니다. */
export function receivedCorrections({ replies = [], chatEntries = [], blocked = new Set(), authorOf }) {
  const community = replies
    .filter((reply) => !blocked.has(reply.authorId))
    .map((reply) => communityCorrectionRow(reply, authorOf(reply.authorId)));
  const chat = chatEntries
    .filter((entry) => !blocked.has(entry.fromUserId))
    .map((entry) => chatCorrectionRow(entry, authorOf(entry.fromUserId)));
  return [...community, ...chat].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}
