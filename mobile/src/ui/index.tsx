/**
 * 화면들이 같이 쓰는 조각들.
 *
 * 웹은 globals.css 의 클래스로 이 역할을 하는데 RN 에는 CSS 가 없어서
 * 컴포넌트로 둡니다. 색은 항상 useTheme() 에서 받습니다 — 값을 박아두면
 * 다크 모드에서 안 보이는 글자가 생깁니다.
 */
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { drawablePhoto } from "../lib/format";
import { t } from "../lib/i18n";
import { radius, space, tapSize } from "../lib/theme";
import { useTheme } from "../lib/useTheme";

export function Avatar({
  name,
  photo,
  size = 44,
  online,
}: {
  name: string;
  photo?: string;
  size?: number;
  online?: boolean;
}) {
  const c = useTheme();
  const uri = drawablePhoto(photo);
  return (
    <View>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View
          style={[
            { width: size, height: size, borderRadius: size / 2, backgroundColor: c.sunken },
            styles.center,
          ]}
        >
          <Text style={{ color: c.muted, fontSize: size * 0.4, fontWeight: "700" }}>
            {name.slice(0, 1)}
          </Text>
        </View>
      )}
      {online ? (
        <View
          style={[
            styles.onlineDot,
            { backgroundColor: c.primary, borderColor: c.bg, width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 },
          ]}
        />
      ) : null}
    </View>
  );
}

/**
 * 비어 있는 화면.
 *
 * "왜" 비었는지를 반드시 구분합니다 — 아직 아무것도 없는 것과 못 받아온 것은
 * 사용자가 할 일이 다릅니다. 못 받아온 경우에만 다시 시도 버튼을 답니다.
 */
export function EmptyState({
  title,
  body,
  onRetry,
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
}) {
  const c = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: c.ink }]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, { color: c.subtle }]}>{body}</Text> : null}
      {onRetry ? (
        <Pressable
          style={[styles.retry, { borderColor: c.line }]}
          onPress={onRetry}
          accessibilityRole="button"
        >
          <Text style={{ color: c.ink, fontSize: 13, fontWeight: "600" }}>{t("다시 시도")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Loading() {
  const c = useTheme();
  return (
    <View style={[styles.center, { flex: 1, backgroundColor: c.bg }]}>
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const c = useTheme();
  const off = disabled || busy;
  return (
    <Pressable
      style={[styles.primary, { backgroundColor: off ? c.sunken : c.primary }]}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
    >
      {busy ? (
        <ActivityIndicator color={c.onPrimary} />
      ) : (
        <Text style={{ color: off ? c.subtle : c.onPrimary, fontSize: 15, fontWeight: "700" }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** 켜고 끄는 알약 단추. 웹의 .chip 과 같은 자리입니다. */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? c.primary : c.surfaceSoft,
          borderColor: active ? c.primary : c.line,
        },
      ]}
    >
      <Text
        style={{
          color: active ? c.onPrimary : c.muted,
          fontSize: 13,
          fontWeight: active ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** 화면 위쪽 구획 탭. 웹의 .segmented-tabs 와 같습니다. */
export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (next: T) => void;
}) {
  const c = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: c.sunken }]}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: c.surface }]}
          >
            <Text
              style={{
                color: active ? c.ink : c.muted,
                fontSize: 13,
                fontWeight: active ? "700" : "600",
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  onlineDot: { position: "absolute", right: 0, bottom: 0, borderWidth: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.sm },
  emptyTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  retry: {
    minHeight: tapSize,
    marginTop: space.sm,
    paddingHorizontal: space.lg,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.button,
  },
  primary: {
    height: tapSize + 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: space.md,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
  },
  segmented: { flexDirection: "row", gap: space.xs, padding: space.xs, borderRadius: radius.button },
  segment: {
    flex: 1,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
});
