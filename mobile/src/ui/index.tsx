/**
 * 화면들이 같이 쓰는 조각들.
 *
 * 인상은 Threads 를 참고했습니다 — 글마다 테두리 상자를 두르지 않고 얇은
 * 구분선으로만 나눕니다. 상자가 많으면 화면이 촘촘해 보이고, 정작 내용보다
 * 상자가 먼저 보입니다. 대신 글자를 키우고 여백을 넓혔습니다.
 *
 * 색은 항상 useTheme() 에서 받습니다 — 값을 박아두면 다크 모드에서 안 보이는
 * 글자가 생깁니다.
 */
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import {
  renderAvatarSvg,
  type AvatarConfig,
  type AvatarMode,
} from "@shared/avatar";
import { drawablePhoto } from "../lib/format";
import { t } from "../lib/i18n";
import { radius, space, tapSize, type } from "../lib/theme";
import { useTheme } from "../lib/useTheme";

/** 이름 첫 글자 아바타의 배경. 사람마다 늘 같은 색이 나와야 알아볼 수 있습니다. */
const TINTS = ["#00c853", "#FFC300", "#38bdf8", "#f472b6", "#a78bfa", "#fb923c"];
function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

export function Avatar({
  name,
  photo,
  avatarMode,
  avatarConfig,
  size = 44,
  online,
}: {
  name: string;
  photo?: string;
  avatarMode?: AvatarMode;
  avatarConfig?: AvatarConfig | null;
  size?: number;
  online?: boolean;
}) {
  const c = useTheme();
  const uri = drawablePhoto(photo);
  const tint = tintFor(name);
  const character = avatarMode === "character" && avatarConfig ? renderAvatarSvg(avatarConfig) : "";
  return (
    <View accessibilityRole="image" accessibilityLabel={name}>
      {character ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: "hidden",
          }}
        >
          <SvgXml xml={character} width={size} height={size} />
        </View>
      ) : uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View
          style={[
            { width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
            styles.center,
          ]}
        >
          <Text style={{ color: "#0b0b0d", fontSize: size * 0.42, fontWeight: "800" }}>
            {name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      {online ? (
        <View
          style={[
            styles.onlineDot,
            {
              backgroundColor: c.primary,
              borderColor: c.bg,
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: size * 0.15,
            },
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
  emoji,
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
  emoji?: string;
}) {
  const c = useTheme();
  return (
    <View style={styles.empty}>
      {emoji ? (
        <View style={[styles.emptyBadge, { backgroundColor: c.sunken }]}>
          <Text style={{ fontSize: 30 }}>{emoji}</Text>
        </View>
      ) : null}
      <Text style={[type.title, { color: c.ink, textAlign: "center" }]}>{title}</Text>
      {body ? (
        <Text style={[type.body, { color: c.subtle, textAlign: "center" }]}>{body}</Text>
      ) : null}
      {onRetry ? (
        <Pressable
          style={[styles.retry, { backgroundColor: c.sunken }]}
          onPress={onRetry}
          accessibilityRole="button"
        >
          <Text style={{ color: c.ink, fontSize: 14, fontWeight: "700" }}>{t("다시 시도")}</Text>
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
  tone = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** 노랑은 "지금 이걸 하세요" 가 아니라 "이런 것도 있어요" 자리에 씁니다. */
  tone?: "primary" | "secondary";
}) {
  const c = useTheme();
  const off = disabled || busy;
  const fill = tone === "secondary" ? c.secondary : c.primary;
  const ink = tone === "secondary" ? c.onSecondary : c.onPrimary;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: off ? c.sunken : fill, opacity: pressed && !off ? 0.85 : 1 },
      ]}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
    >
      {busy ? (
        <ActivityIndicator color={ink} />
      ) : (
        <Text style={{ color: off ? c.subtle : ink, fontSize: 15, fontWeight: "800" }}>{label}</Text>
      )}
    </Pressable>
  );
}

/** 켜고 끄는 알약 단추. */
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
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? c.primary : c.sunken,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: active ? c.onPrimary : c.muted,
          fontSize: 14,
          fontWeight: active ? "800" : "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * 화면 위쪽 구획 탭.
 *
 * 고른 것만 진하게 칠하고 나머지는 배경을 비웁니다. 회색 상자 안에 흰 알약을
 * 넣는 방식보다 눌린 것이 훨씬 또렷합니다.
 */
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
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.segment,
              { backgroundColor: active ? c.ink : "transparent", opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text
              style={{
                color: active ? c.bg : c.subtle,
                fontSize: 14,
                fontWeight: active ? "800" : "600",
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

/** 작은 표시. 노랑은 여기서 제 몫을 합니다 — 눈에 띄되 행동을 재촉하지 않습니다. */
export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" }) {
  const c = useTheme();
  const accent = tone === "accent";
  return (
    <View style={[styles.badge, { backgroundColor: accent ? c.secondary : c.sunken }]}>
      <Text
        style={{
          color: accent ? c.onSecondary : c.muted,
          fontSize: 11.5,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** 목록 사이의 얇은 선. 상자 대신 이것으로 나눕니다. */
export function Divider() {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  onlineDot: { position: "absolute", right: -1, bottom: -1, borderWidth: 2.5 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md },
  emptyBadge: { width: 68, height: 68, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  retry: {
    minHeight: tapSize,
    marginTop: space.xs,
    paddingHorizontal: space.xl,
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  primary: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  segmented: { flexDirection: "row", gap: space.xs },
  segment: {
    minHeight: 36,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
});
