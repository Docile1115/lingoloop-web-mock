/**
 * 선 아이콘. 시안과 같은 그림을 react-native-svg 로 그립니다(웹·앱 공통).
 * 이모지는 쓰지 않습니다 — 기기마다 모양이 달라 화면이 흔들립니다.
 */
import Svg, { Circle, Path, Rect } from "react-native-svg";

type Shape =
  | { d: string; fill?: boolean }
  | { circle: [number, number, number]; fill?: boolean }
  | { rect: [number, number, number, number, number] };

const ICONS = {
  today: [{ circle: [12, 12, 4] }, { d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" }],
  chat: [{ d: "M4 5h16v11H9l-5 4z" }],
  community: [{ circle: [9, 8, 3.5] }, { d: "M2.5 20c.8-3.8 3.3-6 6.5-6s5.7 2.2 6.5 6" }, { d: "M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .8 3.2 2.7 3.5 5.5" }],
  notes: [{ d: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" }, { d: "M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" }],
  me: [{ circle: [12, 8, 4] }, { d: "M4 21c1-4.5 4.2-7 8-7s7 2.5 8 7" }],
  search: [{ circle: [11, 11, 7] }, { d: "M20 20l-4-4" }],
  bell: [{ d: "M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z" }, { d: "M10 20a2 2 0 0 0 4 0" }],
  send: [{ d: "M4 12l16-8-6 16-2.5-6.5z" }],
  mic: [{ rect: [9, 3, 6, 11, 3] }, { d: "M5 11a7 7 0 0 0 14 0M12 18v3" }],
  plus: [{ d: "M12 5v14M5 12h14" }],
  back: [{ d: "M15 6l-6 6 6 6" }],
  chevronRight: [{ d: "M9 6l6 6-6 6" }],
  more: [{ circle: [5, 12, 1.6], fill: true }, { circle: [12, 12, 1.6], fill: true }, { circle: [19, 12, 1.6], fill: true }],
  play: [{ d: "M8 5l11 7-11 7z", fill: true }],
  translate: [{ d: "M4 5h9M8.5 3v2M6 5c.5 3 2.5 5.5 5 7M11 5c-.8 3.5-3 6.5-6.5 8" }, { d: "M13 21l4-10 4 10M14.5 17.5h5" }],
  pencil: [{ d: "M4 20h4L19 9l-4-4L4 16z" }, { d: "M13.5 6.5l4 4" }],
  bookmark: [{ d: "M6 3h12v18l-6-4-6 4z" }],
  bookmarkFilled: [{ d: "M6 3h12v18l-6-4-6 4z", fill: true }],
  speaker: [{ d: "M4 9h4l5-4v14l-5-4H4z" }, { d: "M16.5 8.5a5 5 0 0 1 0 7" }],
  timer: [{ circle: [12, 13, 8] }, { d: "M12 9v4l2.5 2.5M9 2h6" }],
  spark: [{ d: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", fill: true }],
  check: [{ d: "M5 12.5l4.5 4.5L19 7" }],
  close: [{ d: "M6 6l12 12M18 6L6 18" }],
  flame: [{ d: "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.6 2.5 3-.5-3 0-6 .5-8.5z" }],
  globe: [{ circle: [12, 12, 9] }, { d: "M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" }],
  logout: [{ d: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" }, { d: "M10 8l-4 4 4 4M6 12h10" }],
  refresh: [{ d: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" }],
  shield: [{ d: "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" }],
  trash: [{ d: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" }, { d: "M10 11v6M14 11v6" }],
  flag: [{ d: "M5 21V4M5 4h11l-2 4 2 4H5" }],
  bellOff: [{ d: "M6 16v-5a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2h-15" }, { d: "M10 20a2 2 0 0 0 4 0M3 3l18 18" }],
  block: [{ circle: [12, 12, 9] }, { d: "M5.6 5.6l12.8 12.8" }],
  inbox: [{ d: "M4 13l2.5-7h11L20 13v6H4z" }, { d: "M4 13h5l1 2h4l1-2h5" }],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  color,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      {(ICONS[name] as Shape[]).map((shape, index) => {
        const stroke = { stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
        if ("circle" in shape) {
          const [cx, cy, r] = shape.circle;
          return shape.fill ? <Circle key={index} cx={cx} cy={cy} r={r} fill={color} /> : <Circle key={index} cx={cx} cy={cy} r={r} {...stroke} />;
        }
        if ("rect" in shape) {
          const [x, y, width, height, rx] = shape.rect;
          return <Rect key={index} x={x} y={y} width={width} height={height} rx={rx} {...stroke} />;
        }
        return shape.fill ? <Path key={index} d={shape.d} fill={color} /> : <Path key={index} d={shape.d} {...stroke} />;
      })}
    </Svg>
  );
}
