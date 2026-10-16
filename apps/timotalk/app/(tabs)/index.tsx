/**
 * 오늘: 하루에 할 일을 한 화면에.
 *  - 오늘의 파트너(위의 3명) — 휴대폰은 한 명을 크게, 넓은 화면은 셋을 나란히
 *  - 내 차례 — 내 답을 기다리는 대화
 */
import { useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useNotifications } from "@/features/notifications/store";
import { MyTurn } from "@/features/today/MyTurn";
import { PartnerCard } from "@/features/today/PartnerCard";
import { useDailyMatches } from "@/features/today/data";
import { t } from "@/lib/i18n";
import { useMe } from "@/lib/session";
import { longDate } from "@/lib/time";
import { languageName, learningSummary } from "@/lib/words";
import { useTheme } from "@/theme/theme";
import { radius, space, WIDE_BREAKPOINT } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { SectionHeader } from "@/ui/Bits";
import { Button, IconButton } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Page } from "@/ui/Page";
import { EmptyState, ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";

export default function Today() {
  const { c } = useTheme();
  const router = useRouter();
  const me = useMe();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  /* 오른쪽 칸(내 차례)은 카드 셋이 한 줄에 들어갈 만큼 넓을 때만 둡니다. 아니면 아래로 내립니다. */
  const aside = width >= 1180;
  const { state, reload } = useDailyMatches();
  const { unreadCount } = useNotifications();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const recommendations = state.status === "ready" ? state.data.recommendations : [];
  const targets = state.status === "ready" ? state.data.targetLanguages : [];
  const featured = recommendations.find((item) => item.partner.id === selectedId) ?? recommendations[0];
  const others = recommendations.filter((item) => item !== featured);

  const partners =
    state.status === "loading" ? (
      <LoadingState label={t("오늘의 파트너를 찾고 있어요")} />
    ) : state.status === "error" ? (
      <ErrorState message={state.error} onRetry={reload} />
    ) : !featured ? (
      <EmptyState
        title={t("오늘은 맞는 파트너를 찾지 못했어요")}
        body={t("알려 줄 말이나 조건을 바꾸면 바로 다시 찾아 드려요.")}
        action={<Button label={t("조건 바꾸기")} icon="sliders" variant="secondary" onPress={() => router.push("/discover/filters")} />}
      />
    ) : wide ? (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.lg }}>
        {recommendations.map((item) => (
          <View key={item.partner.id} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 }}>
            <PartnerCard recommendation={item} />
          </View>
        ))}
      </View>
    ) : (
      <View style={{ gap: space.md }}>
        <PartnerCard key={featured.partner.id} recommendation={featured} />
        {others.map((item) => (
          <Pressable
            key={item.partner.id}
            onPress={() => setSelectedId(item.partner.id)}
            accessibilityRole="button"
            accessibilityLabel={t("{name}님 카드 보기", { name: item.partner.name })}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
              paddingVertical: space.sm + 2,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: pressed ? c.surfaceSoft : c.surface,
            })}
          >
            <Avatar name={item.partner.name} photo={item.partner.avatarUrl} avatarMode={item.partner.avatarMode} avatarConfig={item.partner.avatarConfig} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {item.partner.name}
              </Text>
              <Text variant="meta" tone="muted" numberOfLines={1}>
                {learningSummary(item.partner)}
              </Text>
            </View>
            <Icon name="chevronRight" size={18} color={c.muted} strokeWidth={2} />
          </Pressable>
        ))}
      </View>
    );

  return (
    <Page onRefresh={reload} refreshing={false}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text variant="meta" tone="muted">
            {longDate()}
          </Text>
          <Text variant="display" accessibilityRole="header">
            {t("안녕하세요, {name}님", { name: me.name })}
          </Text>
        </View>
        <IconButton
          icon="bell"
          label={unreadCount ? t("알림, 안 읽은 알림 {n}개", { n: unreadCount }) : t("알림")}
          dot={unreadCount > 0}
          onPress={() => router.push("/notifications")}
        />
      </View>

      <View style={{ flexDirection: aside ? "row" : "column", gap: space.xxl, alignItems: "flex-start" }}>
        <View style={{ flex: aside ? 1 : undefined, width: aside ? undefined : "100%", minWidth: 0, gap: space.md }}>
          <SectionHeader
            title={t("오늘의 파트너")}
            detail={
              targets.length && recommendations.length
                ? t("{language}를 알려 줄 {n}명 · 내일 새로 와요", { language: targets.map(languageName).join(" · "), n: recommendations.length })
                : t("내일 새로 와요")
            }
            action={<Button label={t("더 찾아보기")} icon="search" variant="ghost" onPress={() => router.push("/discover")} />}
          />
          {partners}
        </View>
        <View style={{ width: aside ? 300 : "100%" }}>
          <MyTurn />
        </View>
      </View>
    </Page>
  );
}
