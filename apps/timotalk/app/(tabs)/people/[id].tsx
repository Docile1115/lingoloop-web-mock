/**
 * 다른 사람의 프로필. 오늘의 파트너·더 찾아보기·대화방 머리에서 엽니다.
 * 없는 사람·활동 중이 아닌 사람·차단한 사이는 서버가 모두 같은 404 로 답합니다(차단 여부를 드러내지 않음).
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PartnerMenu } from "@/features/people/PartnerMenu";
import { useStartChat } from "@/features/people/useStartChat";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { localTimeIn } from "@/lib/time";
import type { Profile } from "@/lib/types";
import { availabilityName, interestName, languageName, levelName, placeName } from "@/lib/words";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Card, Chip, Pill } from "@/ui/Bits";
import { Button, IconButton } from "@/ui/Button";
import { Page } from "@/ui/Page";
import { ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";

const COLUMN = 640;

export default function PartnerProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    api<Profile>(`/api/partners/${encodeURIComponent(id)}`)
      .then((data) => {
        if (alive) setPartner(data);
      })
      .catch((caught) => {
        if (alive) setLoadError(failureText(caught, t("불러오지 못했어요.")));
      });
    return () => {
      alive = false;
    };
  }, [id, attempt]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <Page>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: -space.sm }}>
        <IconButton icon="back" label={t("뒤로")} plain onPress={back} />
        {partner ? <IconButton icon="more" label={t("프로필 메뉴")} plain onPress={() => setMenuOpen(true)} /> : null}
      </View>
      <View style={{ width: "100%", maxWidth: COLUMN }}>
        {loadError ? (
          <ErrorState
            message={loadError}
            onRetry={() => {
              setLoadError("");
              setAttempt((n) => n + 1);
            }}
          />
        ) : !partner ? (
          <LoadingState />
        ) : (
          <ProfileBody partner={partner} />
        )}
      </View>
      {partner ? <PartnerMenu partner={partner} open={menuOpen} onClose={() => setMenuOpen(false)} onBlocked={back} /> : null}
    </Page>
  );
}

function ProfileBody({ partner }: { partner: Profile }) {
  const { c } = useTheme();
  const { start, busy, existing } = useStartChat();
  const conversation = existing(partner.id);
  const localTime = localTimeIn(partner.country?.code);
  const place = [placeName(partner), localTime ? t("현지 {time}", { time: localTime }) : ""].filter(Boolean).join(" · ");
  const online = partner.status === "online";

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
        <Avatar name={partner.name} photo={partner.avatarUrl} avatarMode={partner.avatarMode} avatarConfig={partner.avatarConfig} size={88} online={online} />
        <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
          <Text variant="display" accessibilityRole="header" numberOfLines={2}>
            {partner.name}
          </Text>
          {place ? (
            <Text variant="callout" tone="muted">
              {place}
            </Text>
          ) : null}
          {online ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
              <Text variant="meta" tone="muted">
                {t("접속 중")}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <Button
        label={conversation ? (conversation.isIncomingRequest ? t("답하기") : t("대화 이어가기")) : t("인사하기")}
        icon={conversation ? "chat" : "send"}
        busy={busy === partner.id}
        onPress={() => void start(partner)}
      />

      <Card>
        <Row label={t("가르칠 수 있는 말")}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs + 2 }}>
            {partner.nativeLanguages.map((code) => (
              <Pill key={code} label={languageName(code)} tone="primary" />
            ))}
          </View>
        </Row>
        <Row label={t("배우는 말")}>
          <View style={{ gap: space.sm }}>
            {partner.learningLanguages.map((item) => (
              <View key={item.code} style={{ gap: space.xxs }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
                  <Text variant="bodyStrong">{languageName(item.code)}</Text>
                  <Pill label={levelName(item.level)} />
                </View>
                {item.goal ? (
                  <Text variant="meta" tone="muted">
                    {t("목표: {goal}", { goal: item.goal })}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </Row>
      </Card>

      {partner.bio ? (
        <View style={{ gap: space.sm }}>
          <Text variant="title">{t("자기소개")}</Text>
          <Text variant="body" tone="inkSoft" selectable>
            {partner.bio}
          </Text>
        </View>
      ) : null}

      {partner.interests?.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="title">{t("관심사")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs + 2 }}>
            {partner.interests.map((code) => (
              <Chip key={code} label={interestName(code)} />
            ))}
          </View>
        </View>
      ) : null}

      {partner.availability?.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="title">{t("주로 대화 가능한 시간")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs + 2 }}>
            {partner.availability.map((code) => (
              <Chip key={code} label={availabilityName(code)} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {children}
    </View>
  );
}
