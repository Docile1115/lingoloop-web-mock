/**
 * 프로필 그림. 지금 서버 데이터와 같은 규칙으로 그립니다(옛 앱과 같음).
 *  - avatarMode 가 character 면 캐릭터 그림(공용 renderAvatarSvg)
 *  - 아니면 사진(데이터 URI 또는 주소). SVG 데이터 URI 는 기기 Image 가 못 그려서 뺍니다.
 *  - 둘 다 없으면 이름 첫 글자
 */
import { Image, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { renderAvatarSvg, type AvatarConfig, type AvatarMode } from "@shared/avatar";
import { useTheme } from "@/theme/theme";
import { Text } from "./Text";

const TINTS = ["#FFE4D2", "#DDEBFF", "#F4E1FF", "#E3F1FF", "#FFF0D6", "#DDF3E4"];

function tintFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length] ?? TINTS[0]!;
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
  photo?: string | null;
  avatarMode?: AvatarMode | null;
  avatarConfig?: AvatarConfig | null;
  size?: number;
  online?: boolean;
}) {
  const { c } = useTheme();
  const character = avatarMode === "character" && avatarConfig ? renderAvatarSvg(avatarConfig) : "";
  const uri = photo && !photo.startsWith("data:image/svg") ? photo : "";
  const round = { width: size, height: size, borderRadius: size / 2, overflow: "hidden" as const };
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={name}>
      {character ? (
        <View style={[round, { backgroundColor: tintFor(name) }]}>
          <SvgXml xml={character} width={size} height={size} />
        </View>
      ) : uri ? (
        <Image source={{ uri }} style={round} />
      ) : (
        <View style={[round, { backgroundColor: tintFor(name), alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ color: "#0F1A14", fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.5), fontWeight: "700" }}>
            {name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      {online ? (
        <View
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: Math.max(10, size * 0.24),
            height: Math.max(10, size * 0.24),
            borderRadius: size,
            backgroundColor: c.primary,
            borderWidth: 2,
            borderColor: c.surface,
          }}
        />
      ) : null}
    </View>
  );
}
