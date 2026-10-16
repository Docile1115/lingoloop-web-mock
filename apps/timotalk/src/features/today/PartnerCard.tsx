/**
 * 오늘의 파트너 카드: 누구인지, 왜 맞는지, AI 가 고른 첫 문장, 인사 보내기.
 */
import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { previewText, useConversations } from "@/features/chats/store";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useMe } from "@/lib/session";
import type { Conversation, Recommendation } from "@/lib/types";
import { learningSummary, matchReasonText, nativeSummary, placeName } from "@/lib/words";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Card, Chip, Pill } from "@/ui/Bits";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { newMessageId, useOpeners } from "./data";

export function PartnerCard({ recommendation }: { recommendation: Recommendation }) {
  const { c } = useTheme();
  const router = useRouter();
  const me = useMe();
  const { conversations, requests, upsert } = useConversations();
  const partner = recommendation.partner;
  // 이미 대화 중(또는 내 요청이 수락 대기 중, 상대가 먼저 요청)이면 첫 인사가 필요 없습니다 — AI 하루 사용량도 아낍니다.
  const existing =
    conversations.find((row) => row.partner?.id === partner.id) ?? requests.find((row) => row.partner?.id === partner.id);
  const openers = useOpeners(existing ? null : partner, recommendation.icebreaker);
  const [sending, setSending] = useState(false);
  const online = partner.status === "online";
  const reasons = (recommendation.matchReasonCodes?.length
    ? recommendation.matchReasonCodes.map((reason, index) => matchReasonText(reason, recommendation.matchReasons[index]))
    : recommendation.matchReasons
  ).slice(0, 2);
  const line = openers.current;

  const send = async () => {
    if (!line?.text || sending) return;
    setSending(true);
    try {
      let conversation = await api<Conversation>("/api/conversations", { body: { partnerId: partner.id } });
      const open = () => router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
      // 내가 이미 요청을 보냈고 아직 수락 전이면 더 보낼 수 없습니다(서버는 요청당 한 통). 대화방에서 기다립니다.
      if (conversation.requestStatus === "pending" && !conversation.isIncomingRequest && conversation.lastSenderId === me.id) {
        upsert(conversation);
        showToast(t("이미 인사를 보냈어요. {name}님이 수락하면 이어서 대화할 수 있어요.", { name: partner.name }));
        open();
        return;
      }
      // 상대가 먼저 요청을 보냈다면, 인사하려는 뜻이 분명하므로 요청을 수락하고 바로 이어 보냅니다.
      if (conversation.isIncomingRequest) {
        await api(`/api/conversations/${encodeURIComponent(conversation.id)}/accept`, { body: {} });
        conversation = { ...conversation, isIncomingRequest: false, requestStatus: "accepted" };
      }
      await api(`/api/conversations/${encodeURIComponent(conversation.id)}/messages`, {
        body: { type: "text", text: line.text, clientMessageId: newMessageId() },
      });
      upsert({ ...conversation, preview: line.text, lastSenderId: me.id, updatedAt: new Date().toISOString() });
      showToast(t("{name}님에게 인사를 보냈어요", { name: partner.name }));
      open();
    } catch (caught) {
      showToast(failureText(caught, t("보내지 못했어요.")), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Avatar name={partner.name} photo={partner.avatarUrl} avatarMode={partner.avatarMode} avatarConfig={partner.avatarConfig} size={52} />
        <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs + 2 }}>
            <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
              {partner.name}
            </Text>
            {online ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
                <Text variant="caption" tone="muted">
                  {t("접속 중")}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="meta" tone="muted" numberOfLines={1}>
            {[placeName(partner), nativeSummary(partner)].filter(Boolean).join(" · ")}
          </Text>
          {/* 단계는 이름 아래에 둡니다. 오른쪽에 두면 좁은 카드에서 이름을 밀어냅니다. */}
          {learningSummary(partner) ? (
            <View style={{ flexDirection: "row", marginTop: space.xs }}>
              <Pill label={learningSummary(partner)} />
            </View>
          ) : null}
        </View>
      </View>

      {reasons.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs + 2 }}>
          {reasons.map((reason) => (
            <Chip key={reason} label={reason} />
          ))}
        </View>
      ) : null}

      {existing ? (
        <View style={{ backgroundColor: c.surfaceSoft, borderRadius: radius.md - 2, paddingVertical: space.md, paddingHorizontal: space.md + 2, gap: space.xs, minHeight: 92 }}>
          <Text variant="label" tone="primaryStrong">
            {existing.isIncomingRequest
              ? t("{name}님이 먼저 인사했어요", { name: partner.name })
              : existing.requestStatus === "pending"
                ? t("수락을 기다리고 있어요")
                : t("이미 대화하고 있어요")}
          </Text>
          <Text variant="callout" tone="inkSoft" numberOfLines={2}>
            {previewText(existing)}
          </Text>
        </View>
      ) : (
      <View style={{ backgroundColor: c.surfaceSoft, borderRadius: radius.md - 2, paddingVertical: space.md, paddingHorizontal: space.md + 2, gap: space.xs, minHeight: 92 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Icon name="spark" size={14} color={c.primaryStrong} />
          <Text variant="label" tone="primaryStrong">
            {openers.status === "fallback" ? t("첫 인사") : t("AI 첫 인사 제안")}
          </Text>
        </View>
        {openers.status === "loading" || openers.status === "idle" ? (
          <Text variant="callout" tone="muted" aria-live="polite">
            {t("{name}님에게 건넬 첫 문장을 고르고 있어요", { name: partner.name })}
          </Text>
        ) : line ? (
          <>
            <Text variant="body" style={{ fontWeight: "500" }} selectable>
              {line.text}
            </Text>
            {line.translation ? (
              <Text variant="meta" tone="muted" selectable>
                {line.translation}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="callout" tone="muted">
            {t("첫 문장을 고르지 못했어요. 대화방에서 직접 인사해 보세요.")}
          </Text>
        )}
      </View>
      )}

      {/* 좁은 카드에서는 주 버튼이 다음 줄로 내려갑니다(글자가 두 줄로 꺾이지 않게). */}
      {existing ? (
        <Button
          label={existing.isIncomingRequest ? t("답하기") : t("대화 이어가기")}
          icon="chat"
          onPress={() => router.push({ pathname: "/chat/[id]", params: { id: existing.id } })}
        />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {openers.hasAlternatives ? <Button label={t("다른 문장")} variant="secondary" onPress={openers.next} disabled={sending} /> : null}
          <View style={{ flexGrow: 1, minWidth: 150 }}>
            <Button label={t("인사 보내기")} icon="send" busy={sending} disabled={!line?.text} onPress={() => void send()} />
          </View>
        </View>
      )}
    </Card>
  );
}
