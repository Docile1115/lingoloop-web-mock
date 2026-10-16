/**
 * 사진·음성 메시지 공통 규칙.
 *
 * 서버는 사진·음성을 데이터 URI 로 메시지 문서에 함께 담고(파일 저장소가 아직 없음), 52만 자를 넘으면 받지 않습니다
 * (backend/validate.mjs MEDIA_MAX_LENGTH). 그래서 보내기 전에 기기에서 줄입니다.
 *  - 사진: 긴 변 1280px·JPEG 68% → 그래도 크면 960px·50% (옛 앱과 같은 단계)
 *  - 음성: 30초까지. 앱은 AAC(audio/mp4), 웹은 브라우저가 고른 형식(크롬 webm/opus, 사파리 mp4)
 */
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export const MAX_MEDIA_DATA_URI = 520_000;
export const VOICE_MAX_MS = 30_000;
/** 이보다 짧으면 실수로 누른 것으로 보고 보내지 않습니다. */
export const VOICE_MIN_MS = 400;

export type PhotoResult = { status: "picked"; media: string } | { status: "cancelled" } | { status: "too-large" };

/** 사진 보관함에서 한 장 골라, 서버 한도 안으로 줄인 JPEG 데이터 URI 를 돌려줍니다. */
export async function pickPhoto(): Promise<PhotoResult> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false, quality: 1 });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return { status: "cancelled" };

  const render = async (maxSide: number, quality: number) => {
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > maxSide) {
      if (asset.width >= asset.height) context.resize({ width: maxSide });
      else context.resize({ height: maxSide });
    }
    const image = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
    return image.base64 ? `data:image/jpeg;base64,${image.base64}` : "";
  };

  let media = await render(1280, 0.68);
  if (media.length > MAX_MEDIA_DATA_URI) media = await render(960, 0.5);
  if (!media || media.length > MAX_MEDIA_DATA_URI) return { status: "too-large" };
  return { status: "picked", media };
}

/** "data:audio/webm;codecs=opus;base64,..." 에서 형식(audio/webm)을 꺼냅니다. */
export function mediaMime(media: string): string {
  const match = /^data:([^;,]+)/.exec(media);
  return match ? match[1]!.toLowerCase() : "";
}

/** 0:07 */
export function formatSeconds(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
