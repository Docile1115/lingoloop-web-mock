/**
 * 폰 알림(푸시).
 *
 * 앱이 꺼져 있어도 새 메시지·대화 요청·교정을 알 수 있게, 앱 안 알림(notifications.mjs)을 만든 같은 일에서
 * 폰 알림도 보냅니다. 좋아요·팔로우·집 소식은 앱 안 알림으로만 둡니다 — 밤에 폰을 울릴 만큼 급하지 않습니다.
 *
 * 발송은 Expo 푸시 서비스(exp.host)에 맡깁니다. 앱(expo-notifications)이 기기마다 Expo 푸시 토큰을 받아
 * 등록하고, Expo 가 그 토큰을 Apple(APNs)·Google(FCM)로 넘깁니다. 서버에 패키지가 따로 필요 없고,
 * Apple·Google 자격 정보는 Expo(EAS) 프로젝트에 한 번 올려 두면 됩니다.
 *
 *  - 기기 토큰: pushTokens/{토큰 해시}. 문서 id 가 토큰이라 한 기기는 한 사람에게만 묶입니다 —
 *    다른 계정으로 로그인해 다시 등록하면 그 사람에게로 옮겨 갑니다. 한 사람당 기기는 MAX_DEVICES_PER_USER 개까지.
 *  - 알림 문구는 기기가 등록할 때 알려 준 화면 언어(ko·en·ja)로 만듭니다. 서버에 사람별 화면 언어가 없어서입니다.
 *  - 실패해도 메시지 전송은 성공으로 둡니다. 폰 알림은 덤이고, 앱 안 알림과 목록은 이미 저장됐습니다.
 *    끝까지 기다리되 timeoutMs 를 넘기지 않습니다(Cloud Run 은 응답 뒤의 일을 보장하지 않습니다).
 *  - Expo 가 "더는 없는 기기"(DeviceNotRegistered)라고 답한 토큰은 지웁니다. 앱을 지운 기기입니다.
 *
 * server.mjs 는 불러오는 순간 Firebase 에 붙고 포트를 열어서, 경로와 발송 함수를 이 파일에 두고
 * 필요한 것을 넘겨받습니다(account-deletion.mjs 와 같은 방식).
 */
import crypto from "node:crypto";

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
export const PUSH_TOKENS = "pushTokens";
/** 한 사람이 알림을 받는 기기 수. 넘으면 가장 오래 갱신되지 않은 기기부터 뺍니다. */
export const MAX_DEVICES_PER_USER = 10;
/** 폰 알림을 보내는 알림 종류 */
export const PUSH_TYPES = new Set(["message", "message_request", "request_accepted", "post_correction", "post_reply", "comment_reply"]);
/** Expo 가 한 번에 받는 알림 수 */
const EXPO_BATCH = 100;
const LOCALES = ["ko", "en", "ja"];
const TOKEN_PATTERN = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/;

/** 앱 안 알림 문구(app/lib/i18n)와 같은 말을 씁니다. {name}·{text} 를 채웁니다. */
const TEXTS = {
  ko: {
    someone: "누군가",
    image: "사진을 보냈어요",
    voice: "음성 메시지를 보냈어요",
    correction: "내 문장을 고쳐 줬어요 · {text}",
    requestTitle: "{name}님의 메시지 요청",
    accepted: "메시지 요청을 수락했어요",
    postCorrection: "내 글을 고쳐 줬어요 · {text}",
    postReply: "내 글에 댓글을 남겼어요 · {text}",
    commentReply: "내 댓글에 답글을 남겼어요 · {text}",
  },
  en: {
    someone: "Someone",
    image: "Sent a photo",
    voice: "Sent a voice message",
    correction: "Corrected your sentence · {text}",
    requestTitle: "Message request from {name}",
    accepted: "Accepted your message request",
    postCorrection: "Corrected your post · {text}",
    postReply: "Commented on your post · {text}",
    commentReply: "Replied to your comment · {text}",
  },
  ja: {
    someone: "誰か",
    image: "写真を送りました",
    voice: "音声メッセージを送りました",
    correction: "あなたの文章を添削しました · {text}",
    requestTitle: "{name}さんからのメッセージリクエスト",
    accepted: "メッセージリクエストを承認しました",
    postCorrection: "あなたの投稿を添削しました · {text}",
    postReply: "あなたの投稿にコメントしました · {text}",
    commentReply: "あなたのコメントに返信しました · {text}",
  },
};

export function isExpoPushToken(value) {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/** 토큰을 그대로 문서 id 로 쓰지 않습니다(괄호가 들어 있고, 로그·콘솔에 토큰이 드러납니다). */
export function pushTokenId(token) {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 40);
}

/** "ja-JP" → "ja". 모르는 언어는 한국어로 보냅니다(앱의 기본 화면 언어). */
export function pushLocale(value) {
  const code = String(value || "").toLowerCase().split(/[-_]/)[0];
  return LOCALES.includes(code) ? code : "ko";
}

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

/**
 * 알림 한 건의 제목과 본문. 제목은 보낸 사람 이름이고(요청은 "…님의 메시지 요청"), 본문은 실제로 쓴 글입니다.
 * messageType 은 메시지 알림일 때 메시지 형식(text·image·voice·correction)입니다 — 사진·음성의 text 는
 * 서버가 채운 한국어 한 줄이라 쓰지 않습니다.
 */
export function pushText({ type, excerpt = "" }, { actorName, messageType = "text", locale = "ko" }) {
  const words = TEXTS[pushLocale(locale)];
  const name = actorName || words.someone;
  const text = excerpt;
  const messageBody =
    messageType === "image" ? words.image : messageType === "voice" ? words.voice : messageType === "correction" ? fill(words.correction, { text }) : text;
  switch (type) {
    case "message":
      return { title: name, body: messageBody };
    case "message_request":
      return { title: fill(words.requestTitle, { name }), body: messageBody };
    case "request_accepted":
      return { title: name, body: words.accepted };
    case "post_correction":
      return { title: name, body: fill(words.postCorrection, { text }) };
    case "post_reply":
      return { title: name, body: fill(words.postReply, { text }) };
    case "comment_reply":
      return { title: name, body: fill(words.commentReply, { text }) };
    default:
      return null;
  }
}

/** 기기마다 보낼 Expo 알림. 누르면 열 화면을 data 에 담습니다(앱의 알림 목록과 같은 기준). */
export function buildPushMessages(item, devices) {
  const { notification } = item;
  if (!PUSH_TYPES.has(notification.type)) return [];
  return devices.flatMap((device) => {
    const text = pushText(notification, { ...item, locale: device.locale });
    if (!text) return [];
    return [
      {
        to: device.token,
        title: text.title,
        body: text.body,
        sound: "default",
        priority: "high",
        // 앱이 만든 안드로이드 알림 채널(src/lib/push.native.ts)
        channelId: "default",
        // 눌러서 열면 앱이 그 알림을 읽음으로 바꿉니다(PATCH /api/notifications/:id/read 가 eventId 를 확인).
        data: {
          notificationId: notification.id,
          eventId: notification.eventId,
          type: notification.type,
          conversationId: notification.conversationId || "",
          postId: notification.postId || "",
        },
      },
    ];
  });
}

/**
 * Expo 에 보냅니다. 돌려주는 값은 지워야 할 토큰(DeviceNotRegistered)과 보낸 수입니다.
 * 요청 자체가 실패하면(망·시간 초과·5xx) 던집니다 — 부르는 쪽이 로그만 남깁니다.
 */
export async function sendExpoPush(messages, { fetchImpl = fetch, url = EXPO_PUSH_URL, accessToken = "", timeoutMs = 3000 } = {}) {
  const invalidTokens = [];
  let sent = 0;
  for (let start = 0; start < messages.length; start += EXPO_BATCH) {
    const batch = messages.slice(start, start + EXPO_BATCH);
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Expo push request failed with ${response.status}`);
    const tickets = (await response.json())?.data;
    if (!Array.isArray(tickets)) throw new Error("Expo push response had no tickets");
    tickets.forEach((ticket, index) => {
      if (ticket?.status === "ok") sent += 1;
      else if (ticket?.details?.error === "DeviceNotRegistered" && batch[index]) invalidTokens.push(batch[index].to);
    });
  }
  return { sent, invalidTokens };
}

/**
 * 알림을 만든 일이 끝난 뒤 부릅니다. items: [{ notification, messageType? }], actorName: 보낸 사람 이름.
 * 받는 사람마다 등록된 기기를 읽어 한 번에 보냅니다. 어떤 실패도 던지지 않습니다.
 */
export function createPushDelivery({ db, fetchImpl, url = EXPO_PUSH_URL, accessToken = "", timeoutMs = 3000, log = console }) {
  return async function deliverPush(items, { actorName = "", requestId = "" } = {}) {
    const wanted = items.filter((item) => item?.notification && PUSH_TYPES.has(item.notification.type));
    if (!wanted.length) return { sent: 0, removed: 0 };
    try {
      const recipients = [...new Set(wanted.map((item) => item.notification.recipientId))];
      const devicesByRecipient = new Map(
        await Promise.all(
          recipients.map(async (uid) => {
            const snapshot = await db.collection(PUSH_TOKENS).where("uid", "==", uid).limit(MAX_DEVICES_PER_USER).get();
            return [uid, snapshot.docs.map((document) => document.data())];
          }),
        ),
      );
      const messages = wanted.flatMap((item) =>
        buildPushMessages({ ...item, actorName }, devicesByRecipient.get(item.notification.recipientId) || []),
      );
      if (!messages.length) return { sent: 0, removed: 0 };
      const { sent, invalidTokens } = await sendExpoPush(messages, { fetchImpl, url, accessToken, timeoutMs });
      await Promise.all([...new Set(invalidTokens)].map((token) => db.collection(PUSH_TOKENS).doc(pushTokenId(token)).delete()));
      return { sent, removed: invalidTokens.length };
    } catch (error) {
      log.warn(JSON.stringify({ requestId, code: "PUSH_DELIVERY_FAILED", message: error?.message }));
      return { sent: 0, removed: 0, failed: true };
    }
  };
}

/**
 * POST /api/push/devices   { token, platform: "ios" | "android", locale } — 이 기기에서 알림 받기(앱을 열 때마다 다시 보냄)
 * DELETE /api/push/devices { token } — 이 기기에서 알림 끄기·로그아웃
 */
export function registerPushRoutes(app, { db, requireUser, success, ApiError, nowIso }) {
  const tokenFrom = (body) => {
    if (!isExpoPushToken(body?.token)) {
      throw new ApiError(422, "VALIDATION_ERROR", "알림 토큰을 확인해 주세요.", { field: "token" });
    }
    return body.token;
  };

  app.post("/api/push/devices", requireUser, async (req, res) => {
    const token = tokenFrom(req.body);
    const platform = req.body?.platform;
    if (!["ios", "android"].includes(platform)) {
      throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 기기입니다.", { field: "platform" });
    }
    const uid = req.auth.uid;
    const id = pushTokenId(token);
    await db.collection(PUSH_TOKENS).doc(id).set({ id, token, uid, platform, locale: pushLocale(req.body?.locale), updatedAt: nowIso() });
    // 기기가 너무 많으면 가장 오래 갱신되지 않은 것부터 뺍니다(앱을 지운 기기는 Expo 가 알려 주기 전까지 남습니다).
    const snapshot = await db.collection(PUSH_TOKENS).where("uid", "==", uid).limit(50).get();
    const extra = snapshot.docs
      .map((document) => document.data())
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .slice(MAX_DEVICES_PER_USER);
    await Promise.all(extra.map((device) => db.collection(PUSH_TOKENS).doc(device.id).delete()));
    return success(res, req, { registered: true });
  });

  app.delete("/api/push/devices", requireUser, async (req, res) => {
    const reference = db.collection(PUSH_TOKENS).doc(pushTokenId(tokenFrom(req.body)));
    const snapshot = await reference.get();
    // 다른 계정에 묶인 기기는 건드리지 않습니다(그 사람이 이 기기에서 다시 로그인해 등록한 것).
    const removed = snapshot.exists && snapshot.data().uid === req.auth.uid;
    if (removed) await reference.delete();
    return success(res, req, { removed });
  });
}
