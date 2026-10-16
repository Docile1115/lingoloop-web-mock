/**
 * 프로필 편집. 첫 설정과 같은 칸에 자기소개를 더했습니다.
 * 배우는 말을 바꾸면 오늘의 파트너 조건도 그 말로 맞춥니다(features/profile/save.ts).
 */
import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { draftFromProfile, fieldFromServer, profileErrors, type ProfileDraft, type ProfileErrors, type ProfileField } from "@/features/profile/draft";
import { ProfileForm } from "@/features/profile/ProfileForm";
import { saveProfile } from "@/features/profile/save";
import { ApiError, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useMe, useSession } from "@/lib/session";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Page } from "@/ui/Page";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

const SECTIONS: Array<{ title: () => string; detail?: () => string; fields: readonly ProfileField[] }> = [
  { title: () => t("나에 대해"), fields: ["name", "bio", "age", "gender", "country"] },
  {
    title: () => t("주고받는 말"),
    detail: () => t("배우는 말을 바꾸면 오늘의 파트너도 그 말의 원어민으로 바뀌어요."),
    fields: ["native", "learning", "level", "goal"],
  },
  { title: () => t("관심사와 시간"), fields: ["interests", "availability"] },
];

export default function EditProfile() {
  const router = useRouter();
  const me = useMe();
  const { setMe } = useSession();
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(me));
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<ProfileErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const errors = { ...(tried ? profileErrors(draft, false) : {}), ...serverErrors };
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFromProfile(me));

  const change = (next: ProfileDraft) => {
    setDraft(next);
    setServerErrors({});
    setError("");
  };

  const save = async () => {
    if (busy) return;
    setTried(true);
    if (Object.keys(profileErrors(draft, false)).length) {
      setError(t("고칠 칸이 있어요. 빨간 글씨를 확인해 주세요."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await saveProfile(draft, me, false);
      setMe(saved);
      showToast(t("프로필을 저장했어요"));
      if (router.canGoBack()) router.back();
      else router.replace("/me");
    } catch (caught) {
      const field = caught instanceof ApiError ? fieldFromServer(caught.field) : null;
      const message = failureText(caught, t("프로필을 저장하지 못했어요."));
      if (field) setServerErrors({ [field]: message });
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <ScreenHeader title={t("프로필 편집")} fallback="/me" />
      <View style={{ width: "100%", maxWidth: 560, gap: space.xxxl }}>
        {SECTIONS.map((section) => (
          <View key={section.fields.join()} style={{ gap: space.lg }}>
            <View style={{ gap: space.xxs }}>
              <Text variant="title" accessibilityRole="header">
                {section.title()}
              </Text>
              {section.detail ? (
                <Text variant="meta" tone="muted">
                  {section.detail()}
                </Text>
              ) : null}
            </View>
            <ProfileForm draft={draft} onChange={change} errors={errors} fields={section.fields} disabled={busy} />
          </View>
        ))}

        <View style={{ gap: space.md }}>
          {error ? (
            <Text variant="callout" tone="danger" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button label={t("저장")} icon="check" busy={busy} disabled={!dirty} onPress={() => void save()} />
        </View>
      </View>
    </Page>
  );
}
