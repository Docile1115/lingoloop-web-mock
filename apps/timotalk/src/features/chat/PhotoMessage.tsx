/**
 * 사진 메시지: 말풍선 안에 비율을 지켜 작게, 누르면 화면 가득 크게 봅니다.
 * 크게 보기는 어두운 바탕이 사진을 가장 잘 보여 줘서 화면 색과 상관없이 검은 바탕입니다.
 */
import { useEffect, useState } from "react";
import { Image, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "@/lib/i18n";
import { radius, space } from "@/theme/tokens";
import { IconButton } from "@/ui/Button";

const WIDTH = 220;

export function PhotoMessage({ media }: { media: string }) {
  const insets = useSafeAreaInsets();
  const [ratio, setRatio] = useState(1);
  const [open, setOpen] = useState(false);
  const height = Math.round(Math.min(300, Math.max(140, WIDTH / ratio)));

  // 사진 비율을 재서 말풍선 높이를 맞춥니다(웹의 onLoad 는 크기를 주지 않습니다).
  useEffect(() => {
    let alive = true;
    Image.getSize(
      media,
      (width, measured) => {
        if (alive && width && measured) setRatio(width / measured);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [media]);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="imagebutton" accessibilityLabel={t("사진 크게 보기")}>
        <Image
          source={{ uri: media }}
          style={{ width: WIDTH, height, borderRadius: radius.md }}
          resizeMode="cover"
        />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.92)" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={t("닫기")}>
            <Image source={{ uri: media }} style={{ flex: 1 }} resizeMode="contain" accessibilityLabel={t("사진")} />
          </Pressable>
          <View style={{ position: "absolute", top: insets.top + space.md, right: space.md }}>
            <IconButton icon="close" label={t("닫기")} onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
