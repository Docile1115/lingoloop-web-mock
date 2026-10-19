/**
 * 나: 내 프로필 요약과 설정 목록(화면 언어 · 받는 메시지 · 차단한 사람 · 폰 알림 · 계정).
 * 운영자(서버 ADMIN_UIDS)에게는 신고 검토 줄이 더 보입니다.
 */
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { PushSetting } from "@/features/notifications/PushSetting";
import { changeLocale, LOCALE_LABEL, LOCALES, t, useLocale } from "@/lib/i18n";
import { useSession, useMe } from "@/lib/session";
import { languageName, learningSummary, placeName } from "@/lib/words";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Card } from "@/ui/Bits";
import { Button } from "@/ui/Button";
import { ConfirmDialog } from "@/ui/Dialog";
import { ListGroup, ListRow } from "@/ui/List";
import { Page } from "@/ui/Page";
import { Text } from "@/ui/Text";

const COLUMN = 560;

export default function Me() {
  const { c } = useTheme();
  const router = useRouter();
  const me = useMe();
  const { signOut, isAdmin } = useSession();
  const { locale } = useLocale();
  const [askSignOut, setAskSignOut] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const natives = me.nativeLanguages.map(languageName).join(" · ");

  return (
    <Page>
      <Text variant="display" accessibilityRole="header">
        {t("나")}
      </Text>

      <Card style={{ maxWidth: COLUMN }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <Avatar name={me.name} photo={me.avatarUrl} avatarMode={me.avatarMode} avatarConfig={me.avatarConfig} size={64} />
          <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
            <Text variant="title" numberOfLines={1}>
              {me.name}
            </Text>
            <Text variant="meta" tone="muted" numberOfLines={1}>
              {[placeName(me), natives ? t("{language} 원어민", { language: natives }) : ""].filter(Boolean).join(" · ")}
            </Text>
            {learningSummary(me) ? (
              <Text variant="meta" tone="primaryStrong" style={{ fontWeight: "600" }}>
                {t("배우는 중: {summary}", { summary: learningSummary(me) })}
              </Text>
            ) : null}
          </View>
        </View>
        {me.bio ? (
          <Text variant="callout" tone="inkSoft" numberOfLines={4}>
            {me.bio}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row" }}>
          <Button label={t("프로필 편집")} icon="pencil" variant="secondary" onPress={() => router.push("/me/edit")} />
        </View>
      </Card>

      <View style={{ gap: space.md, maxWidth: COLUMN }}>
        <Text variant="title">{t("화면 언어")}</Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
          {LOCALES.map((code) => {
            const selected = code === locale;
            return (
              <Pressable
                key={code}
                onPress={() => changeLocale(code)}
                accessibilityRole="radio"
                aria-checked={selected}
                style={{
                  minHeight: 44,
                  paddingHorizontal: space.lg,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: selected ? c.primaryStrong : c.line,
                  backgroundColor: selected ? c.primarySoft : c.surface,
                  justifyContent: "center",
                }}
              >
                <Text variant="body" style={{ fontWeight: selected ? "700" : "500", color: selected ? c.primaryStrong : c.ink }}>
                  {LOCALE_LABEL[code]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: space.xl, maxWidth: COLUMN }}>
        <ListGroup title={t("대화와 안전")}>
          <ListRow icon="chat" title={t("받는 메시지")} detail={t("누가 나에게 대화를 걸 수 있는지 정해요.")} onPress={() => router.push("/me/messages")} />
          <ListRow icon="shield" title={t("차단한 사람")} detail={t("차단을 풀거나 확인해요.")} onPress={() => router.push("/me/blocked")} />
        </ListGroup>

        <PushSetting />

        {isAdmin ? (
          <ListGroup title={t("운영")}>
            <ListRow icon="flag" title={t("신고 검토")} detail={t("접수된 신고를 보고 처리해요.")} onPress={() => router.push("/me/reports")} />
          </ListGroup>
        ) : null}

        <ListGroup title={t("계정")}>
          <ListRow icon="logout" title={t("로그아웃")} onPress={() => setAskSignOut(true)} trailing={null} />
          <ListRow icon="trash" title={t("계정 삭제")} danger onPress={() => router.push("/me/delete-account")} />
        </ListGroup>
      </View>

      <ConfirmDialog
        visible={askSignOut}
        title={t("로그아웃할까요?")}
        body={t("다시 로그인하면 대화와 기록이 그대로 있어요.")}
        confirmLabel={t("로그아웃")}
        busy={leaving}
        onClose={() => setAskSignOut(false)}
        onConfirm={() => {
          setLeaving(true);
          void signOut().finally(() => setLeaving(false));
        }}
      />
    </Page>
  );
}
