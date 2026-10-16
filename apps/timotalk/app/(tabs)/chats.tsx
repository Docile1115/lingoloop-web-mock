/**
 * 대화 목록과 받은 메시지 요청함.
 * 요청은 줄에서 바로 수락·삭제할 수 있고, 누르면 대화방에서 첫 메시지를 보고 정할 수 있습니다.
 * 요청을 지우면 같은 사람은 7일 동안 다시 요청하지 못합니다(서버 규칙).
 */
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { acceptRequest, declineRequest, spamSignalNames } from "@/features/chats/actions";
import { isMyTurn, previewText, useConversations } from "@/features/chats/store";
import { failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { relativeTime } from "@/lib/time";
import type { Conversation } from "@/lib/types";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Card, CountBadge, Pill } from "@/ui/Bits";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Page } from "@/ui/Page";
import { Segmented } from "@/ui/Segmented";
import { EmptyState, ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

type Box = "inbox" | "requests";

export default function Chats() {
  const router = useRouter();
  const params = useLocalSearchParams<{ box?: string }>();
  const { conversations, requests, loading, error, reload } = useConversations();
  // 어느 함을 볼지는 주소(?box=requests)가 정합니다. 탭이 이미 열려 있어도 요청함으로 바로 보낼 수 있습니다.
  const box: Box = params.box === "requests" ? "requests" : "inbox";
  const rows = box === "inbox" ? conversations : requests;

  return (
    <Page onRefresh={() => void reload()} refreshing={false}>
      <View style={{ gap: space.lg }}>
        <Text variant="display" accessibilityRole="header">
          {t("대화")}
        </Text>
        <Segmented
          label={t("대화함")}
          value={box}
          onChange={(next) => router.setParams({ box: next })}
          options={[
            { value: "inbox", label: t("대화") },
            { value: "requests", label: t("요청"), count: requests.length },
          ]}
        />
      </View>
      {loading && !rows.length ? (
        <LoadingState />
      ) : error && !rows.length ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : rows.length === 0 ? (
        box === "inbox" ? (
          <EmptyState title={t("아직 대화가 없어요")} body={t("오늘 화면에서 파트너에게 인사해 보세요.")} />
        ) : (
          <EmptyState title={t("받은 요청이 없어요")} body={t("내 오늘의 파트너가 아닌 사람이 인사하면 여기로 와요.")} />
        )
      ) : (
        <Card padded={false}>
          {rows.map((conversation, index) =>
            box === "inbox" ? (
              <ConversationRow key={conversation.id} conversation={conversation} first={index === 0} />
            ) : (
              <RequestRow key={conversation.id} conversation={conversation} first={index === 0} />
            ),
          )}
        </Card>
      )}
    </Page>
  );
}

function ConversationRow({ conversation, first }: { conversation: Conversation; first: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  const partner = conversation.partner;
  const name = partner?.name ?? t("알 수 없는 사용자");
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/chat/[id]", params: { id: conversation.id } })}
      accessibilityRole="link"
      accessibilityLabel={t("{name}님과의 대화", { name })}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        backgroundColor: pressed ? c.surfaceSoft : "transparent",
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.lineSoft,
      })}
    >
      <Avatar name={name} photo={partner?.avatarUrl} avatarMode={partner?.avatarMode} avatarConfig={partner?.avatarConfig} size={48} online={partner?.status === "online"} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </Text>
          {isMyTurn(conversation) ? <Pill label={t("내 차례")} tone="primary" /> : null}
          {conversation.requestStatus === "pending" ? <Pill label={t("수락 대기")} /> : null}
          {conversation.muted ? <Icon name="bellOff" size={14} color={c.faint} /> : null}
          <Text variant="caption" tone="muted" style={{ marginLeft: "auto" }}>
            {relativeTime(conversation.updatedAt)}
          </Text>
        </View>
        <Text variant="callout" tone={conversation.unreadCount ? "ink" : "muted"} numberOfLines={1}>
          {previewText(conversation)}
        </Text>
      </View>
      <CountBadge count={conversation.unreadCount} />
    </Pressable>
  );
}

function RequestRow({ conversation, first }: { conversation: Conversation; first: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  const { upsert, remove } = useConversations();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const partner = conversation.partner;
  const name = partner?.name ?? t("알 수 없는 사용자");
  const signals = spamSignalNames(conversation.spamSignals);

  const accept = async () => {
    if (busy) return;
    setBusy("accept");
    try {
      const accepted = await acceptRequest(conversation.id);
      upsert(accepted);
      showToast(t("{name}님의 요청을 수락했어요", { name }));
      router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
    } catch (caught) {
      showToast(failureText(caught, t("수락하지 못했어요.")), "error");
      setBusy(null);
    }
  };

  const decline = async () => {
    if (busy) return;
    setBusy("decline");
    try {
      await declineRequest(conversation.id);
      remove(conversation.id);
      showToast(t("요청을 지웠어요. {name}님은 7일 동안 다시 요청할 수 없어요.", { name }));
    } catch (caught) {
      showToast(failureText(caught, t("지우지 못했어요.")), "error");
      setBusy(null);
    }
  };

  return (
    <View style={{ paddingVertical: space.md, paddingHorizontal: space.lg, gap: space.md, borderTopWidth: first ? 0 : 1, borderTopColor: c.lineSoft }}>
      <Pressable
        onPress={() => router.push({ pathname: "/chat/[id]", params: { id: conversation.id } })}
        accessibilityRole="link"
        accessibilityLabel={t("{name}님의 요청 보기", { name })}
        style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
      >
        <Avatar name={name} photo={partner?.avatarUrl} avatarMode={partner?.avatarMode} avatarConfig={partner?.avatarConfig} size={48} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
              {name}
            </Text>
            <Text variant="caption" tone="muted" style={{ marginLeft: "auto" }}>
              {relativeTime(conversation.updatedAt)}
            </Text>
          </View>
          <Text variant="callout" tone="inkSoft" numberOfLines={2}>
            {previewText(conversation)}
          </Text>
        </View>
      </Pressable>
      {signals.length ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs + 2, backgroundColor: c.attentionSoft, borderRadius: 10, paddingVertical: space.xs + 2, paddingHorizontal: space.md }}>
          <Icon name="shield" size={15} color={c.onAttentionSoft} />
          <Text variant="meta" style={{ color: c.onAttentionSoft, flex: 1 }}>
            {t("스팸일 수 있어요: {signals}", { signals: signals.join(", ") })}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button label={t("삭제")} variant="secondary" busy={busy === "decline"} disabled={Boolean(busy)} onPress={() => void decline()} />
        <Button label={t("수락")} icon="check" grow busy={busy === "accept"} disabled={Boolean(busy)} onPress={() => void accept()} />
      </View>
    </View>
  );
}
