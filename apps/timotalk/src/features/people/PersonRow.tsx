/**
 * 사람 한 줄(더 찾아보기·검색 결과): 얼굴 · 이름 · 사는 곳과 모국어 · 배우는 말, 그리고 맞는 이유 한두 개.
 * 누르면 프로필로 갑니다.
 */
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { learningSummary, nativeSummary, placeName } from "@/lib/words";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Chip, Pill } from "@/ui/Bits";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";

export function PersonRow({ person, reasons = [], first }: { person: Profile; reasons?: string[]; first: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/people/[id]", params: { id: person.id } })}
      accessibilityRole="link"
      accessibilityLabel={t("{name} 프로필", { name: person.name })}
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
      <Avatar name={person.name} photo={person.avatarUrl} avatarMode={person.avatarMode} avatarConfig={person.avatarConfig} size={48} online={person.status === "online"} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {person.name}
          </Text>
          {learningSummary(person) ? <Pill label={learningSummary(person)} /> : null}
        </View>
        <Text variant="meta" tone="muted" numberOfLines={1}>
          {[placeName(person), nativeSummary(person)].filter(Boolean).join(" · ")}
        </Text>
        {reasons.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xxs }}>
            {reasons.slice(0, 2).map((reason) => (
              <Chip key={reason} label={reason} />
            ))}
          </View>
        ) : null}
      </View>
      <Icon name="chevronRight" size={18} color={c.faint} />
    </Pressable>
  );
}
