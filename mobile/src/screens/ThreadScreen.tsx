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
import { radius, space, tapSize } from "../lib/theme";
import { EmptyState, Loading } from "../ui";

export function ThreadScreen({ conversation }: { conversation: Conversation }) {
  const c = useTheme();
  const { me } = useSession();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
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

      <View style={[styles.composer, { borderTopColor: c.line, backgroundColor: c.surface }]}>
        <TextInput
          style={[styles.input, { backgroundColor: c.sunken, color: c.ink }]}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("메시지 보내기")}
          placeholderTextColor={c.subtle}
          multiline
          maxLength={2000}
          editable={!sending}
        />
        <Pressable
          onPress={() => void send()}
          disabled={!draft.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel={t("보내기")}
          style={[styles.send, { backgroundColor: draft.trim() && !sending ? c.primary : c.sunken }]}
        >
          <Ionicons name="arrow-up" size={20} color={draft.trim() && !sending ? c.onPrimary : c.subtle} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

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
  input: {
    flex: 1,
    minHeight: tapSize,
    maxHeight: 120,
    paddingHorizontal: space.md,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: radius.lg,
    fontSize: 15,
  },
  send: { width: tapSize, height: tapSize, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
});
