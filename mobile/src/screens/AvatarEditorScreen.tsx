/** 내 프로필에 쓰는 2D 캐릭터 편집기. 서버에는 허용된 아이템 ID만 저장합니다. */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, usePreventRemove, type NavigationProp } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AVATAR_CATEGORIES,
  AVATAR_CATEGORY_KEYS,
  DEFAULT_AVATAR_CONFIG,
  normalizeAvatarConfig,
  randomAvatarConfig,
  type AvatarCategory,
  type AvatarConfig,
  type AvatarMode,
} from "@shared/avatar";
import type { RootParams } from "../Navigation";
import { ApiError, api } from "../lib/api";
import { t, type MessageKey } from "../lib/i18n";
import { useSession } from "../lib/session";
import { radius, space, tapSize, type } from "../lib/theme";
import { useTheme } from "../lib/useTheme";
import { Avatar, Loading } from "../ui";

const CATEGORY_LABELS: Record<AvatarCategory, MessageKey> = {
  skinTone: "피부색",
  face: "얼굴",
  hair: "헤어스타일",
  hairColor: "머리 색상",
  eyes: "눈",
  mouth: "입",
  outfit: "의상",
  outfitColor: "의상 색상",
  accessory: "액세서리",
  background: "배경",
};

const copyConfig = (value: unknown): AvatarConfig => ({ ...normalizeAvatarConfig(value) });
const sameConfig = (left: AvatarConfig, right: AvatarConfig) =>
  AVATAR_CATEGORY_KEYS.every((category) => left[category] === right[category]);

export function AvatarEditorScreen({ onDone }: { onDone: () => void }) {
  const c = useTheme();
  const navigation = useNavigation<NavigationProp<RootParams>>();
  const { me, refresh } = useSession();
  const initial = useRef<AvatarConfig>(copyConfig(me?.avatarConfig));
  const [draft, setDraft] = useState<AvatarConfig>(() => copyConfig(me?.avatarConfig));
  const [category, setCategory] = useState<AvatarCategory>("skinTone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [leaveApproved, setLeaveApproved] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const updateDraft = useCallback((next: unknown) => {
    setDraft(copyConfig(next));
    setError("");
  }, []);
  const dirty = !sameConfig(draft, initial.current);
  const canSaveCharacter = me?.avatarMode !== "character" || dirty;

  /* 화면의 취소, iOS 스와이프, 안드로이드 뒤로 가기를 같은 규칙으로 다룹니다. */
  useEffect(() => {
    if (!leaveApproved) return;
    const leave = pendingLeave.current;
    pendingLeave.current = null;
    leave?.();
  }, [leaveApproved]);

  usePreventRemove(!leaveApproved && (dirty || busy), ({ data }) => {
      if (busy) {
        return;
      }
      Alert.alert(
        t("변경 내용을 버릴까요?"),
        t("저장하지 않은 캐릭터 변경 내용이 사라져요."),
        [
          { text: t("계속 편집"), style: "cancel" },
          {
            text: t("변경 내용 버리기"),
            style: "destructive",
            onPress: () => {
              pendingLeave.current = () => navigation.dispatch(data.action);
              setLeaveApproved(true);
            },
          },
        ],
      );
  });

  const save = useCallback(async (mode: AvatarMode) => {
    if (busy || !me) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/profile/avatar", {
        method: "PATCH",
        body: JSON.stringify({ mode, config: draft }),
      });
      await refresh();
      pendingLeave.current = onDone;
      setLeaveApproved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      setBusy(false);
    }
  }, [busy, draft, me, onDone, refresh]);

  if (!me) return <Loading />;

  const options = AVATAR_CATEGORIES.find((item) => item.key === category)?.options ?? [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: c.line, backgroundColor: c.surface }]}>
        <Pressable
          onPress={onDone}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("취소")}
          style={styles.headerAction}
        >
          <Text style={[styles.headerActionText, { color: c.muted }]}>{t("취소")}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.ink }]} numberOfLines={1}>
          {t("캐릭터 꾸미기")}
        </Text>
        <Pressable
          onPress={() => void save("character")}
          disabled={busy || !canSaveCharacter}
          accessibilityRole="button"
          accessibilityLabel={t("저장")}
          accessibilityState={{ disabled: busy || !canSaveCharacter }}
          style={styles.headerAction}
        >
          {busy ? (
            <ActivityIndicator size="small" color={c.primaryStrong} />
          ) : (
            <Text
              style={[
                styles.headerActionText,
                { color: canSaveCharacter ? c.primaryStrong : c.subtle },
              ]}
            >
              {t("저장")}
            </Text>
          )}
        </Pressable>
      </View>

      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.error, { color: c.danger, borderBottomColor: c.line }]}
        >
          {error}
        </Text>
      ) : null}

      <View style={styles.previewSection}>
        <View style={[styles.previewRing, { backgroundColor: c.surfaceSoft, borderColor: c.line }]}>
          <Avatar
            name={`${me.name} · ${t("캐릭터 미리보기")}`}
            avatarMode="character"
            avatarConfig={draft}
            size={160}
          />
        </View>
        <View style={styles.quickActions}>
          <Pressable
            onPress={() => updateDraft(randomAvatarConfig())}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t("랜덤 만들기")}
            style={({ pressed }) => [
              styles.quickAction,
              { borderColor: c.line, backgroundColor: c.surfaceSoft, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Ionicons name="shuffle" size={18} color={c.ink} />
            <Text style={[type.meta, { color: c.ink, fontWeight: "700" }]}>
              {t("랜덤 만들기")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => updateDraft(DEFAULT_AVATAR_CONFIG)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t("기본으로")}
            style={({ pressed }) => [
              styles.quickAction,
              { borderColor: c.line, backgroundColor: c.surfaceSoft, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Ionicons name="refresh" size={18} color={c.ink} />
            <Text style={[type.meta, { color: c.ink, fontWeight: "700" }]}>
              {t("기본으로")}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
          accessibilityRole="tablist"
        >
          {AVATAR_CATEGORIES.map((item) => {
            const selected = category === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setCategory(item.key)}
                disabled={busy}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.category,
                  {
                    backgroundColor: selected ? c.ink : c.sunken,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text style={{ color: selected ? c.bg : c.muted, fontSize: 14, fontWeight: "700" }}>
                  {t(CATEGORY_LABELS[item.key])}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.optionGrid}>
          {options.map((option, index) => {
            const selected = draft[category] === option.id;
            const preview = copyConfig({ ...draft, [category]: option.id });
            const optionLabel = option.id === "accessory-none"
              ? t("없음")
              : t("스타일 {n}", { n: index + 1 });
            return (
              <Pressable
                key={option.id}
                onPress={() => updateDraft(preview)}
                disabled={busy}
                accessibilityRole="radio"
                accessibilityLabel={`${t(CATEGORY_LABELS[category])} ${optionLabel}`}
                accessibilityState={{ checked: selected, disabled: busy }}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: c.surfaceSoft,
                    borderColor: selected ? c.primaryStrong : c.line,
                    borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Avatar
                  name={`${t(CATEGORY_LABELS[category])} ${optionLabel}`}
                  avatarMode="character"
                  avatarConfig={preview}
                  size={58}
                />
                <Text style={{ color: selected ? c.primaryStrong : c.subtle, fontSize: 11, fontWeight: selected ? "800" : "600" }}>
                  {optionLabel}
                </Text>
                {selected ? (
                  <View style={[styles.check, { backgroundColor: c.primaryStrong }]}>
                    <Ionicons name="checkmark" size={12} color="#ffffff" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {me.avatarUrl ? (
          <Pressable
            onPress={() => void save("photo")}
            disabled={busy || me.avatarMode !== "character"}
            accessibilityRole="button"
            accessibilityLabel={t("기존 프로필 사진 사용")}
            accessibilityState={{ disabled: busy || me.avatarMode !== "character" }}
            style={({ pressed }) => [
              styles.photoAction,
              {
                borderColor: c.line,
                opacity: busy || me.avatarMode !== "character" ? 0.45 : pressed ? 0.72 : 1,
              },
            ]}
          >
            <Avatar name={me.name} photo={me.avatarUrl} avatarMode="photo" size={40} />
            <Text style={[type.meta, { color: c.ink, fontWeight: "700", flex: 1 }]}>
              {t("기존 프로필 사진 사용")}
            </Text>
            <Ionicons name="image-outline" size={19} color={c.muted} />
          </Pressable>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerAction: {
    minWidth: 76,
    minHeight: tapSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
  },
  headerActionText: { fontSize: 15, fontWeight: "700" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800" },
  page: { paddingBottom: space.xl, gap: space.lg },
  previewSection: {
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  previewRing: {
    width: 176,
    height: 176,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 88,
  },
  quickActions: { flexDirection: "row", gap: space.sm },
  quickAction: {
    minHeight: tapSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    paddingHorizontal: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
  },
  categories: { gap: space.sm, paddingHorizontal: space.lg },
  category: {
    minHeight: tapSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  option: {
    position: "relative",
    width: "22.5%",
    minHeight: 90,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  check: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 19,
    height: 19,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  photoAction: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginHorizontal: space.lg,
    paddingHorizontal: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  error: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    textAlign: "center",
    fontSize: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
