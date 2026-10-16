/**
 * 나: 내 프로필 요약, 화면 언어, 로그아웃. 프로필 편집·설정은 2단계에서 붙입니다.
 */
import { useState } from "react";
import { Pressable, View } from "react-native";
import { changeLocale, LOCALE_LABEL, LOCALES, t, useLocale } from "@/lib/i18n";
import { useSession, useMe } from "@/lib/session";
import { languageName, learningSummary, placeName } from "@/lib/words";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Card } from "@/ui/Bits";
import { Button } from "@/ui/Button";
import { Page } from "@/ui/Page";
import { Text } from "@/ui/Text";

export default function Me() {
  const { c } = useTheme();
  const me = useMe();
  const { signOut } = useSession();
  const { locale } = useLocale();
  const [leaving, setLeaving] = useState(false);
  const natives = me.nativeLanguages.map(languageName).join(" · ");

  return (
    <Page>
      <Text variant="display" accessibilityRole="header">
        {t("나")}
      </Text>

      <Card style={{ maxWidth: 560 }}>
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
      </Card>

      <View style={{ gap: space.md, maxWidth: 560 }}>
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

      <View style={{ flexDirection: "row" }}>
        <Button
          label={t("로그아웃")}
          icon="logout"
          variant="secondary"
          busy={leaving}
          onPress={() => {
            setLeaving(true);
            void signOut().finally(() => setLeaving(false));
          }}
        />
      </View>
    </Page>
  );
}
