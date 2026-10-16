/**
 * 앱: 데이터 URI 를 캐시 파일로 풀어 expo-audio 에 넘깁니다(재생기는 파일 경로가 필요합니다). 옛 앱과 같은 방식입니다.
 *  - 파일 이름에 대화·메시지 id 와 내용 지문을 넣어, 같은 메시지의 내용이 바뀌어도 이전 파일을 다시 쓰지 않습니다.
 *  - 같은 파일을 여러 말풍선이 쓰면 마지막 하나가 떠날 때 지웁니다.
 *  - iOS 재생기(AVPlayer)는 크롬에서 녹음한 webm·ogg 를 열지 못해 "재생할 수 없음"으로 알립니다.
 */
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { mediaMime } from "../media";
import type { VoiceSource } from "./types";

const users = new Map<string, number>();

/** 재생기는 확장자로 형식을 짐작하므로 실제 형식과 맞춥니다. */
function extensionFor(mime: string): string {
  if (mime.includes("3gpp")) return "3gp";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime === "audio/aac" || mime === "audio/x-aac") return "aac";
  return "m4a";
}

function decodeBase64(value: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of value) {
    const index = alphabet.indexOf(character);
    if (index < 0) continue;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** 내용 지문(FNV-1a) */
function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function release(file: File) {
  const remaining = Math.max(0, (users.get(file.uri) ?? 1) - 1);
  if (remaining) {
    users.set(file.uri, remaining);
    return;
  }
  users.delete(file.uri);
  // 재생기가 파일을 놓은 뒤에 지웁니다. 그 사이 다시 쓰이기 시작하면 남겨 둡니다.
  setTimeout(() => {
    if (users.has(file.uri)) return;
    try {
      if (file.exists) file.delete();
    } catch {
      // 캐시 정리는 할 수 있는 만큼만 합니다.
    }
  }, 250);
}

export function useVoiceSource(conversationId: string, messageId: string, media: string): VoiceSource {
  const [result, setResult] = useState<VoiceSource>({ source: null, unsupported: false });

  useEffect(() => {
    if (!media.startsWith("data:")) return;
    const separator = media.indexOf(";base64,");
    if (separator < 0) return;
    const extension = extensionFor(mediaMime(media));
    let file: File | null = null;
    // 결과는 다음 틱에 알립니다(이 효과 안에서 바로 상태를 바꾸지 않습니다).
    const timer = setTimeout(() => {
      if (Platform.OS === "ios" && (extension === "webm" || extension === "ogg")) {
        setResult({ source: null, unsupported: true });
        return;
      }
      try {
        const payload = media.slice(separator + ";base64,".length);
        const safe = (value: string, fallback: string) => value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || fallback;
        const next = new File(Paths.cache, `timotalk-${safe(conversationId, "chat")}-${safe(messageId, "message")}-${fingerprint(payload)}.${extension}`);
        if (!next.exists) {
          next.create({ overwrite: true, intermediates: true });
          next.write(decodeBase64(payload));
        }
        users.set(next.uri, (users.get(next.uri) ?? 0) + 1);
        file = next;
        setResult({ source: next.uri, unsupported: false });
      } catch {
        setResult({ source: null, unsupported: false });
      }
    }, 0);
    return () => {
      clearTimeout(timer);
      if (file) release(file);
    };
  }, [conversationId, messageId, media]);

  return result;
}
