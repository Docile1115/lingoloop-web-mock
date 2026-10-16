/**
 * 대화방.
 *  - 12초마다 새 메시지만 받습니다(화면이 보이고 앱이 앞에 있을 때만).
 *  - 상대 말을 누르면 번역·저장. AI 코치는 이어 물어볼 말과 다듬은 문장을 줍니다.
 *  - 교환 세션: 20분 동안 앞 절반은 이 상대와 연습하는 말, 뒤 절반은 상대가 연습하는 말(내 모국어)로.
 */
import { useCallback, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { currentLocaleSnapshot } from "@shared/i18n/core";
import { acceptRequest, declineRequest, spamSignalNames } from "@/features/chats/actions";
import { useConversations } from "@/features/chats/store";
import { ThreadMenu } from "@/features/chats/ThreadMenu";
import { Coach } from "@/features/chat/Coach";
import { Composer } from "@/features/chat/Composer";
import { ExchangeStrip } from "@/features/chat/ExchangeStrip";
import { exchangeLanguages, translationTarget } from "@/features/chat/language";
import { MessageBubble, type Translation as BubbleTranslation } from "@/features/chat/MessageBubble";
import { useExchangeSession } from "@/features/chat/useExchangeSession";
import { useMessages, type ChatMessage } from "@/features/chat/useMessages";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useMe } from "@/lib/session";
import type { Conversation, Translation } from "@/lib/types";
import { useAppActive } from "@/lib/useAppActive";
import { clock, localTimeIn, longDate, sameDay } from "@/lib/time";
import { languageName, placeName } from "@/lib/words";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Button, IconButton } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

const POLL_MS = 12_000;
/** 넓은 화면에서 대화가 양 끝으로 벌어지지 않게 막는 폭 */
const CHAT_MAX_WIDTH = 820;
const column = { width: "100%", maxWidth: CHAT_MAX_WIDTH, alignSelf: "center" } as const;
/** 같은 사람이 5분 안에 이어 말하면 한 덩어리로 보고 시각은 마지막에만 적습니다. */
const GROUP_MS = 5 * 60_000;

export default function ChatRoute() {
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { find, loading, error, reload } = useConversations();
  const conversation = id ? find(id) : undefined;

  if (!conversation) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: "center", padding: space.xl }}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : (
          <View style={{ alignItems: "center", gap: space.md }}>
            <Text variant="headline">{t("대화를 찾을 수 없어요.")}</Text>
            <Button label={t("오늘로 돌아가기")} variant="secondary" onPress={() => router.replace("/")} />
          </View>
        )}
      </View>
    );
  }
  return <ChatRoom key={conversation.id} conversation={conversation} />;
}

type Row = { kind: "day"; key: string; label: string } | { kind: "message"; key: string; message: ChatMessage; showTime: boolean; read: boolean };

function ChatRoom({ conversation }: { conversation: Conversation }) {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const active = useAppActive();
  const { markRead, upsert, remove } = useConversations();
  const partner = conversation.partner;
  const partnerName = partner?.name ?? t("알 수 없는 사용자");
  // 이 상대와 연습하는 말(상대의 모국어)과 상대가 연습하는 말(내 모국어). 내가 처음 배우는 말이 아닙니다.
  const { practice: practiceCode, teach: teachCode } = exchangeLanguages(me, partner);
  const practiceName = practiceCode ? languageName(practiceCode) : "";
  const teachName = teachCode ? languageName(teachCode) : "";

  const onFetched = useCallback(() => markRead(conversation.id), [conversation.id, markRead]);
  const { messages, status, error, fetchMessages, send, resend } = useMessages(conversation.id, me.id, onFetched);
  const session = useExchangeSession(conversation.id, practiceName, teachName);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, BubbleTranslation>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [coach, setCoach] = useState<{ draft: string; key: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [answering, setAnswering] = useState<"accept" | "decline" | null>(null);

  // 화면이 보이는 동안만 받습니다. 처음 들어오거나 돌아오면 바로 한 번 받습니다.
  useFocusEffect(
    useCallback(() => {
      void fetchMessages();
      if (!active) return;
      const timer = setInterval(() => void fetchMessages(), POLL_MS);
      return () => clearInterval(timer);
    }, [fetchMessages, active]),
  );

  const pendingMine = conversation.requestStatus === "pending" && !conversation.isIncomingRequest;
  const incoming = Boolean(conversation.isIncomingRequest);
  const sentAlready = messages.some((message) => message.senderId === me.id && message.state !== "failed");
  // 내 요청은 한 통만 보낼 수 있고(서버 규칙), 받은 요청은 수락해야 답할 수 있습니다.
  const composerLocked = (pendingMine && sentAlready) || incoming;
  const leaveRoom = () => router.replace(incoming ? "/chats?box=requests" : "/chats");

  const accept = async () => {
    if (answering) return;
    setAnswering("accept");
    try {
      upsert(await acceptRequest(conversation.id));
      showToast(t("{name}님의 요청을 수락했어요", { name: partnerName }));
    } catch (caught) {
      showToast(failureText(caught, t("수락하지 못했어요.")), "error");
    } finally {
      setAnswering(null);
    }
  };

  const decline = async () => {
    if (answering) return;
    setAnswering("decline");
    try {
      await declineRequest(conversation.id);
      remove(conversation.id);
      showToast(t("요청을 지웠어요. {name}님은 7일 동안 다시 요청할 수 없어요.", { name: partnerName }));
      leaveRoom();
    } catch (caught) {
      showToast(failureText(caught, t("지우지 못했어요.")), "error");
      setAnswering(null);
    }
  };

  const rows = useMemo<Row[]>(() => {
    const lastMine = [...messages].reverse().find((message) => message.senderId === me.id && !message.state);
    const readUntil = conversation.partnerReadAt ?? "";
    const out: Row[] = [];
    messages.forEach((message, index) => {
      const previous = messages[index - 1];
      if (!previous || !sameDay(previous.sentAt, message.sentAt)) {
        out.push({ kind: "day", key: `day-${message.id}`, label: longDate(new Date(message.sentAt)) });
      }
      const next = messages[index + 1];
      const showTime = !next || next.senderId !== message.senderId || Date.parse(next.sentAt) - Date.parse(message.sentAt) > GROUP_MS;
      const read = Boolean(lastMine && message.id === lastMine.id && readUntil && message.sentAt <= readUntil);
      out.push({ kind: "message", key: message.id, message, showTime: showTime || read, read });
    });
    // 목록을 뒤집어 그립니다 — 새 말이 늘 바닥에 붙고, 처음 열 때 맨 아래로 굴릴 필요가 없습니다.
    return out.reverse();
  }, [messages, me.id, conversation.partnerReadAt]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending || composerLocked) return;
    setSending(true);
    setDraft("");
    setCoach(null);
    const ok = await send(text);
    if (!ok) showToast(t("보내지 못했어요."), "error");
    setSending(false);
  };

  const onKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== "web") return;
    // 웹: Enter 로 보내고 Shift+Enter 로 줄바꿈. 한글·일본어 조합 중(isComposing)에는 보내지 않습니다.
    const native = event.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean; isComposing?: boolean; keyCode?: number };
    if (native.key === "Enter" && !native.shiftKey && !native.isComposing && native.keyCode !== 229) {
      event.preventDefault();
      void submit();
    }
  };

  const translate = async (message: ChatMessage) => {
    setTranslations((current) => ({ ...current, [message.id]: { status: "loading" } }));
    try {
      const result = await api<Translation>("/api/translate", {
        body: { text: message.text, targetLanguage: translationTarget(message.text, currentLocaleSnapshot(), practiceCode) },
        slow: true,
      });
      setTranslations((current) => ({ ...current, [message.id]: { status: "ready", text: result.translatedText } }));
    } catch (caught) {
      setTranslations((current) => ({ ...current, [message.id]: { status: "error", text: failureText(caught, t("번역하지 못했어요.")) } }));
    }
  };

  const save = async (message: ChatMessage) => {
    const translation = translations[message.id];
    try {
      await api("/api/saved-phrases", {
        body: { phrase: message.text, meaning: translation?.status === "ready" ? translation.text : "", source: partnerName },
      });
      setSaved((current) => new Set(current).add(message.id));
      showToast(t("표현을 저장했어요"));
    } catch (caught) {
      showToast(failureText(caught, t("저장하지 못했어요.")), "error");
    }
  };

  const localTime = localTimeIn(partner?.country?.code);
  const subtitle = [partner ? placeName(partner) : "", localTime ? t("현지 {time}", { time: localTime }) : ""].filter(Boolean).join(" · ");

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <View style={[column, { height: 60, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.sm }]}>
          <IconButton icon="back" label={t("뒤로")} plain onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
          {/* 상대 얼굴·이름을 누르면 프로필을 봅니다. */}
          <Pressable
            onPress={partner ? () => router.push({ pathname: "/people/[id]", params: { id: partner.id } }) : undefined}
            disabled={!partner}
            accessibilityRole={partner ? "link" : undefined}
            accessibilityLabel={partner ? t("{name} 프로필", { name: partnerName }) : undefined}
            style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space.sm }}
          >
            <Avatar name={partnerName} photo={partner?.avatarUrl} avatarMode={partner?.avatarMode} avatarConfig={partner?.avatarConfig} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="headline" numberOfLines={1} accessibilityRole="header">
                {partnerName}
              </Text>
              {subtitle ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </Pressable>
          {!session.active && !incoming && practiceName && teachName ? (
            <IconButton icon="timer" label={t("교환 세션 시작")} plain onPress={session.start} />
          ) : null}
          <IconButton icon="more" label={t("대화 메뉴")} plain onPress={() => setMenuOpen(true)} />
        </View>
      </View>

      {session.active ? (
        <ExchangeStrip language={session.language} nextLanguage={session.nextLanguage} remaining={session.remaining} progress={session.progress} onStop={session.stop} />
      ) : null}

      {status === "loading" ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <LoadingState />
        </View>
      ) : status === "error" ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorState message={error} onRetry={() => void fetchMessages()} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={rows}
          inverted
          keyExtractor={(row) => row.key}
          contentContainerStyle={[column, { padding: space.lg, gap: space.sm + 2, flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl }}>
              <Text variant="callout" tone="muted" style={{ textAlign: "center" }}>
                {t("첫 마디를 건네보세요")}
              </Text>
            </View>
          }
          renderItem={({ item }) =>
            item.kind === "day" ? (
              <Text variant="caption" tone="muted" style={{ alignSelf: "center", paddingVertical: space.xs }}>
                {item.label}
              </Text>
            ) : (
              <View style={{ gap: 3 }}>
                <MessageBubble
                  message={item.message}
                  mine={item.message.senderId === me.id}
                  open={openId === item.message.id}
                  translation={translations[item.message.id]}
                  saved={saved.has(item.message.id)}
                  onToggle={() => setOpenId((current) => (current === item.message.id ? null : item.message.id))}
                  onTranslate={() => void translate(item.message)}
                  onSave={() => void save(item.message)}
                  onResend={() => void resend(item.message)}
                />
                {item.showTime && !item.message.state ? (
                  <Text variant="caption" tone="muted" style={{ alignSelf: item.message.senderId === me.id ? "flex-end" : "flex-start" }}>
                    {[item.read ? t("읽음") : "", clock(item.message.sentAt)].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
              </View>
            )
          }
        />
      )}

      {pendingMine ? (
        <View style={[column, { marginBottom: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: c.surfaceSoft, flexDirection: "row", gap: space.sm, alignItems: "center" }]}>
          <Icon name="send" size={16} color={c.muted} />
          <Text variant="meta" tone="muted" style={{ flex: 1 }}>
            {t("{name}님이 요청을 수락하면 이어서 대화할 수 있어요.", { name: partnerName })}
          </Text>
        </View>
      ) : null}

      {incoming ? (
        <View style={[column, { marginBottom: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: c.surfaceSoft, gap: space.md }]}>
          <Text variant="callout" tone="inkSoft">
            {t("{name}님이 대화를 요청했어요. 수락하면 답할 수 있어요.", { name: partnerName })}
          </Text>
          {spamSignalNames(conversation.spamSignals).length ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs + 2 }}>
              <Icon name="shield" size={15} color={c.onAttentionSoft} />
              <Text variant="meta" style={{ color: c.onAttentionSoft, flex: 1 }}>
                {t("스팸일 수 있어요: {signals}", { signals: spamSignalNames(conversation.spamSignals).join(", ") })}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button label={t("삭제")} variant="secondary" busy={answering === "decline"} disabled={Boolean(answering)} onPress={() => void decline()} />
            <Button label={t("수락")} icon="check" grow busy={answering === "accept"} disabled={Boolean(answering)} onPress={() => void accept()} />
          </View>
        </View>
      ) : null}

      {coach && partner ? (
        <View style={column}>
        <Coach
          key={coach.key}
          partnerId={partner.id}
          draft={coach.draft}
          onInsert={(text) => {
            setDraft(text);
            setCoach(null);
          }}
          onClose={() => setCoach(null)}
        />
        </View>
      ) : null}

      <Composer
        value={draft}
        onChangeText={setDraft}
        onKeyPress={onKeyPress}
        onSubmit={() => void submit()}
        onSendMedia={(payload) => {
          setCoach(null);
          return send(payload);
        }}
        placeholder={
          incoming
            ? t("요청을 수락하면 답할 수 있어요")
            : composerLocked
              ? t("수락을 기다리고 있어요")
              : practiceName
                ? t("{language}로 답해 보세요", { language: practiceName })
                : t("메시지")
        }
        locked={composerLocked}
        sending={sending}
        coach={partner ? { open: Boolean(coach), onToggle: () => setCoach((current) => (current ? null : { draft, key: Date.now() })) } : null}
        maxWidth={CHAT_MAX_WIDTH}
      />
      <ThreadMenu conversation={conversation} open={menuOpen} onClose={() => setMenuOpen(false)} onGone={leaveRoom} />
    </KeyboardAvoidingView>
  );
}
