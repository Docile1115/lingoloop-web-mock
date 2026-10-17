/**
 * 글쓰기. 배우는 말로 짧게 쓰고, 원어민에게 교정을 부탁할 수 있습니다.
 *  - 쓴 말: 내가 배우는 말과 모국어 중에서 고릅니다(처음엔 첫 번째로 배우는 말). 피드는 이 값으로 "고쳐 줄 수 있는 글"을 고릅니다.
 *  - 공개 범위: 모두 / 대화 상대만. 사진은 한 장까지(대화방 사진과 같은 크기로 줄여 보냅니다).
 * 올리면 그 글 화면으로 바꿔 갑니다(뒤로 가면 글 목록).
 */
import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { PhotoMessage } from "@/features/chat/PhotoMessage";
import { pickPhoto } from "@/features/chat/media";
import { createPost } from "@/features/community/api";
import { failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useMe } from "@/lib/session";
import { languageName } from "@/lib/words";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { ChoiceChip, ChoiceGroup, TextField } from "@/ui/Field";
import { ListGroup, SwitchRow } from "@/ui/List";
import { Page } from "@/ui/Page";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/** 서버가 받는 글 길이 */
const TEXT_MAX = 3000;

export default function Compose() {
  const router = useRouter();
  const me = useMe();
  const learning = me.learningLanguages.map((item) => item.code);
  const languages = [...new Set([...learning, ...me.nativeLanguages])];
  const [text, setText] = useState("");
  const [language, setLanguage] = useState(languages[0] ?? "en");
  const [requestCorrection, setRequestCorrection] = useState(true);
  const [visibility, setVisibility] = useState<"public" | "partners">("public");
  const [photo, setPhoto] = useState("");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const addPhoto = async () => {
    if (picking || busy) return;
    setPicking(true);
    try {
      const result = await pickPhoto();
      if (result.status === "too-large") showToast(t("사진을 줄여도 너무 커요. 다른 사진을 골라주세요."), "error");
      if (result.status === "picked") setPhoto(result.media);
    } catch {
      showToast(t("사진을 열지 못했어요."), "error");
    } finally {
      setPicking(false);
    }
  };

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const post = await createPost({ text: text.trim(), language, requestCorrection, visibility, imageUrl: photo || undefined });
      showToast(t("글을 올렸어요"));
      router.replace({ pathname: "/community/[postId]", params: { postId: post.id } });
    } catch (caught) {
      setError(failureText(caught, t("글을 올리지 못했어요. 다시 시도해 주세요.")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <ScreenHeader title={t("글쓰기")} fallback="/community" detail={t("배우는 말로 오늘 있었던 일을 짧게 써 보세요.")} />
      <View style={{ width: "100%", maxWidth: 560, gap: space.xl }}>
        <ChoiceGroup label={t("어떤 말로 쓰나요?")}>
          {languages.map((code) => (
            <ChoiceChip
              key={code}
              label={learning.includes(code) ? languageName(code) : t("{language} (모국어)", { language: languageName(code) })}
              selected={language === code}
              disabled={busy}
              onPress={() => setLanguage(code)}
            />
          ))}
        </ChoiceGroup>

        <TextField
          label={t("글")}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={TEXT_MAX}
          placeholder={t("오늘 있었던 일, 새로 배운 표현, 궁금한 점…")}
          hint={t("{n} / {max}자", { n: text.length, max: TEXT_MAX })}
          disabled={busy}
        />

        <View style={{ gap: space.sm }}>
          {photo ? <PhotoMessage media={photo} /> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            <Button label={photo ? t("사진 바꾸기") : t("사진 넣기")} icon="image" variant="secondary" busy={picking} disabled={busy} onPress={() => void addPhoto()} />
            {photo ? <Button label={t("사진 빼기")} icon="close" variant="ghost" disabled={busy} onPress={() => setPhoto("")} /> : null}
          </View>
        </View>

        <ListGroup>
          <SwitchRow
            title={t("교정 부탁하기")}
            detail={t("{language} 원어민의 피드 맨 위에 보여요.", { language: languageName(language) })}
            value={requestCorrection}
            onValueChange={setRequestCorrection}
            disabled={busy}
          />
        </ListGroup>

        <ChoiceGroup label={t("누가 볼 수 있나요?")} hint={visibility === "partners" ? t("대화를 시작한 상대만 볼 수 있어요.") : undefined}>
          <ChoiceChip label={t("모두")} selected={visibility === "public"} disabled={busy} onPress={() => setVisibility("public")} />
          <ChoiceChip label={t("대화 상대만")} selected={visibility === "partners"} disabled={busy} onPress={() => setVisibility("partners")} />
        </ChoiceGroup>

        <View style={{ gap: space.md }}>
          {error ? (
            <Text variant="callout" tone="danger" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button label={t("올리기")} icon="send" busy={busy} disabled={!text.trim()} onPress={() => void submit()} />
        </View>
      </View>
    </Page>
  );
}
