/**
 * 대화방.
 *
 * 시각 표기는 카카오톡 규칙을 따릅니다 — 같은 시간대의 말은 한 덩어리로 두고,
 * 30분이 지나거나 날짜가 바뀌면 다시 적습니다. 웹과 같은 규칙입니다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toChatMessage, type ApiMessage } from "@shared/live-data";
import type { ChatMessage, Conversation } from "@shared/demo-data";
import { ApiError, post as apiPost } from "../lib/api";
import { clockOf, dayLabel, needsTimeMark } from "../lib/format";
import { t } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/useTheme";
import { radius, space, type } from "../lib/theme";
import { EmptyState, Loading } from "../ui";

export function ThreadScreen({ conversation }: { conversation: Conversation }) {
  const c = useTheme();
  const { me } = useSession();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [error, setError] = useState("");

  const messages = useApi<ChatMessage[]>(
    `/api/conversations/${conversation.id}/messages`,
    [],
    (raw: ApiMessage[]) => raw.map((row) => toChatMessage(row, me?.id ?? "")),
  );

  // 새 말이 오면 바닥으로. 보내고 나서 위쪽만 보이면 보낸 게 안 보입니다.
  useEffect(() => {
    if (!messages.data.length) return;
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.data.length]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const created = await apiPost<ApiMessage>(
        `/api/conversations/${conversation.id}/messages`,
        { text },
      );
      messages.set((rows) => [...rows, toChatMessage(created, me?.id ?? "")]);
      setDraft("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      setSending(false);
    }
  }, [draft, sending, conversation.id, messages, me?.id]);

  if (messages.loading) return <Loading />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages.data}
        keyExtractor={(row) => row.id}
        contentContainerStyle={messages.data.length ? styles.list : { flexGrow: 1 }}
        ListEmptyComponent={
          messages.error ? (
            <EmptyState title={messages.error} onRetry={messages.refresh} />
          ) : (
            <EmptyState
              title={t("첫 마디를 건네보세요")}
              body={t("짧아도 괜찮아요. 틀려도 괜찮아요.")}
            />
          )
        }
        renderItem={({ item, index }) => {
          const previous = messages.data[index - 1];
          // 서버가 시각을 안 주는 옛 메시지가 섞여 있을 수 있습니다.
          // 없으면 구분선도 시각도 그리지 않습니다 — 지어내지 않습니다.
          const sentAt = item.sentAt ?? "";
          const previousAt = previous?.sentAt ?? "";
          const newDay =
            Boolean(sentAt) &&
            (!previousAt ||
              new Date(sentAt).toDateString() !== new Date(previousAt).toDateString());
          const showTime = Boolean(sentAt) && needsTimeMark(sentAt, previousAt || undefined);
          return (
            <View>
              {newDay ? (
                <Text style={[styles.day, { color: c.subtle, backgroundColor: c.sunken }]}>
                  {dayLabel(sentAt)}
                </Text>
              ) : null}
              <View style={[styles.rowWrap, item.mine ? styles.mineWrap : styles.theirsWrap]}>
                {item.mine && showTime ? (
                  <Text style={[styles.stamp, { color: c.subtle }]}>{clockOf(sentAt)}</Text>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    item.mine
                      ? { backgroundColor: c.primaryStrong, borderBottomRightRadius: radius.xs }
                      : { backgroundColor: c.sunken, borderBottomLeftRadius: radius.xs },
                  ]}
                >
                  <Text style={{ color: item.mine ? "#ffffff" : c.ink, fontSize: 15, lineHeight: 21 }}>
                    {item.text}
                  </Text>
                </View>
                {!item.mine && showTime ? (
                  <Text style={[styles.stamp, { color: c.subtle }]}>{clockOf(sentAt)}</Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

      {attachOpen ? (
        <>
          <Pressable style={styles.scrim} onPress={() => setAttachOpen(false)} accessibilityLabel={t("닫기")} />
          <View style={[styles.attachMenu, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Pressable style={styles.attachItem} onPress={() => setAttachOpen(false)} accessibilityRole="menuitem">
              <Ionicons name="image-outline" size={18} color={c.ink} />
              <Text style={[type.body, { color: c.ink }]}>{t("사진")}</Text>
            </Pressable>
            <Pressable style={styles.attachItem} onPress={() => setAttachOpen(false)} accessibilityRole="menuitem">
              <Ionicons name="mic-outline" size={18} color={c.ink} />
              <Text style={[type.body, { color: c.ink }]}>{t("음성")}</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {/* 웹과 같은 배치입니다 — 첨부는 칸 밖 왼쪽, 이모지·코치는 칸 안 왼쪽,
          보내기는 칸 안 오른쪽에 쓸 것이 있을 때만.
          ＋ 와 칸의 한 줄 높이를 COMPOSER_H 하나로 묶습니다. 높이가 다르면
          바닥만 맞고 중심이 몇 px 어긋납니다. */}
      <View style={[styles.composer, { borderTopColor: c.line, backgroundColor: c.surface }]}>
        <Pressable
          onPress={() => setAttachOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={t("첨부")}
          style={({ pressed }) => [
            styles.round,
            { backgroundColor: attachOpen ? c.primary : c.sunken, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="add" size={24} color={attachOpen ? c.onPrimary : c.ink} />
        </Pressable>

        <View style={[styles.field, { backgroundColor: c.sunken, borderColor: c.line }]}>
          <Pressable
            onPress={() => setDraft((text) => `${text} 😊`)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("이모지")}
            style={styles.inlineAction}
          >
            <Ionicons name="happy-outline" size={20} color={c.muted} />
          </Pressable>
          <Pressable
            onPress={() => setCoachOpen((open) => !open)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("대화 코치")}
            style={styles.inlineAction}
          >
            <Ionicons name="sparkles-outline" size={19} color={coachOpen ? c.primaryStrong : c.muted} />
          </Pressable>

          <TextInput
            style={[styles.input, { color: c.ink }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={t("메시지 보내기")}
            placeholderTextColor={c.subtle}
            multiline
            maxLength={2000}
            editable={!sending}
          />

          {/* 쓸 것이 있을 때만. 다른 안쪽 버튼과 같은 크기라 줄이 흔들리지 않습니다. */}
          {draft.trim() ? (
            <Pressable
              onPress={() => void send()}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={t("보내기")}
              style={({ pressed }) => [
                styles.inlineSend,
                { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="arrow-up" size={20} color={c.onPrimary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* 컴포저 한 줄 높이. 안쪽 아이콘(30) + 위아래 여백(9+9) + 테두리 = 50.
   웹의 --composer-h 와 같은 값입니다. */
const COMPOSER_H = 50;

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: 3 },
  day: {
    alignSelf: "center",
    marginVertical: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    fontSize: 12,
    overflow: "hidden",
  },
  rowWrap: { flexDirection: "row", alignItems: "flex-end", gap: space.xs },
  mineWrap: { justifyContent: "flex-end" },
  theirsWrap: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", paddingHorizontal: space.md, paddingVertical: 9, borderRadius: radius.lg },
  stamp: { fontSize: 11, marginBottom: 2 },
  error: { fontSize: 13, paddingHorizontal: space.lg, paddingBottom: space.xs },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    padding: space.sm,
    paddingHorizontal: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  /* ＋·보내기. 칸의 한 줄 높이와 같아야 바닥 정렬이 곧 중앙 정렬이 됩니다. */
  round: {
    width: COMPOSER_H,
    height: COMPOSER_H,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  field: {
    flex: 1,
    minHeight: COMPOSER_H,
    maxHeight: 132,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
  },
  input: { flex: 1, minHeight: 34, paddingTop: 6, paddingBottom: 6, paddingHorizontal: space.xs, fontSize: 15, lineHeight: 22 },
  inlineAction: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  /* 다른 안쪽 버튼과 같은 크기라 글을 쓰기 시작해도 줄이 흔들리지 않습니다. */
  inlineSend: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, marginLeft: 2 },
  scrim: { ...StyleSheet.absoluteFillObject },
  attachMenu: {
    position: "absolute",
    left: space.md,
    bottom: COMPOSER_H + space.md + 6,
    minWidth: 148,
    padding: space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  attachItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 40,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
});
