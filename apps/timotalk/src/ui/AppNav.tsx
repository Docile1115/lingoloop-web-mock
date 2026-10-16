/**
 * 주요 메뉴. 같은 다섯 곳을 휴대폰에서는 아래 탭으로, 넓은 화면(웹·태블릿)에서는 왼쪽 메뉴로 그립니다.
 */
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConversations } from "@/features/chats/store";
import { t } from "@/lib/i18n";
import { useMe } from "@/lib/session";
import { learningSummary } from "@/lib/words";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Avatar } from "./Avatar";
import { CountBadge } from "./Bits";
import { Brand } from "./Brand";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

const ICON_FOR: Record<string, IconName> = { index: "today", chats: "chat", community: "community", notes: "notes", me: "me" };
/** 메뉴에 없는 숨은 경로와, 그 경로에 있을 때 켜 둘 메뉴 */
const HIDDEN_ROUTES: Record<string, string> = { "chat/[id]": "chats" };

export function AppNav({ state, descriptors, navigation, variant }: BottomTabBarProps & { variant: "bottom" | "side" }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { unreadTotal } = useConversations();
  const me = useMe();

  const current = state.routes[state.index]?.name ?? "";
  const selectedName = HIDDEN_ROUTES[current] ?? current;
  // 휴대폰에서 대화방에 들어가면 아래 탭을 감춥니다 — 입력칸이 화면 아래를 써야 합니다.
  if (variant === "bottom" && HIDDEN_ROUTES[current]) return null;

  const items = state.routes.filter((route) => !HIDDEN_ROUTES[route.name]).map((route) => {
    const focused = route.name === selectedName;
    const label = descriptors[route.key]?.options.title ?? route.name;
    const badge = route.name === "chats" ? unreadTotal : 0;
    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (route.name !== current && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };
    return { key: route.key, name: route.name, label, focused, badge, onPress };
  });

  if (variant === "side") {
    return (
      <View
        accessibilityRole="tablist"
        style={{ width: 240, backgroundColor: c.surface, borderRightWidth: 1, borderRightColor: c.line, paddingTop: space.xxl, paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.xl }}
      >
        <View style={{ paddingHorizontal: space.sm }}>
          <Brand />
        </View>
        <View style={{ gap: space.xxs }}>
          {items.map((item) => (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              accessibilityRole="tab"
              aria-selected={item.focused}
              accessibilityLabel={item.badge ? t("{label}, 안 읽은 메시지 {n}개", { label: item.label, n: item.badge }) : item.label}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                minHeight: 44,
                paddingHorizontal: space.md,
                borderRadius: radius.sm,
                backgroundColor: item.focused ? c.primarySoft : pressed ? c.surfaceSoft : "transparent",
              })}
            >
              <Icon name={ICON_FOR[item.name] ?? "today"} size={20} color={item.focused ? c.primaryStrong : c.inkSoft} strokeWidth={item.focused ? 2 : 1.8} />
              <Text variant="body" style={{ flex: 1, color: item.focused ? c.primaryStrong : c.inkSoft, fontWeight: item.focused ? "700" : "500" }}>
                {item.label}
              </Text>
              <CountBadge count={item.badge} />
            </Pressable>
          ))}
        </View>
        <View style={{ marginTop: "auto", flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: c.bg }}>
          <Avatar name={me.name} photo={me.avatarUrl} avatarMode={me.avatarMode} avatarConfig={me.avatarConfig} size={36} />
          <View style={{ flexShrink: 1 }}>
            <Text variant="callout" style={{ fontWeight: "600" }} numberOfLines={1}>
              {me.name}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {learningSummary(me)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingTop: space.xs,
        paddingBottom: Math.max(insets.bottom, space.sm),
        paddingHorizontal: space.sm,
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          accessibilityRole="tab"
          aria-selected={item.focused}
          accessibilityLabel={item.badge ? t("{label}, 안 읽은 메시지 {n}개", { label: item.label, n: item.badge }) : item.label}
          style={{ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 3 }}
        >
          <Icon name={ICON_FOR[item.name] ?? "today"} size={22} color={item.focused ? c.primaryStrong : c.muted} strokeWidth={item.focused ? 2 : 1.8} />
          <Text variant="tab" style={{ color: item.focused ? c.primaryStrong : c.muted, fontWeight: item.focused ? "700" : "500" }}>
            {item.label}
          </Text>
          {item.badge ? (
            <View style={{ position: "absolute", top: 2, left: "50%", marginLeft: 6 }}>
              <CountBadge count={item.badge} />
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
