/**
 * 웹: 데이터 URI 를 그대로 <audio> 에 넣습니다. 이 브라우저가 그 형식을 못 틀면(사파리의 webm/ogg 등) 알립니다.
 */
import { useMemo } from "react";
import { mediaMime } from "../media";
import type { VoiceSource } from "./types";

export function useVoiceSource(_conversationId: string, _messageId: string, media: string): VoiceSource {
  return useMemo(() => {
    if (!media) return { source: null, unsupported: false };
    const mime = mediaMime(media);
    const probe = typeof document === "undefined" ? null : document.createElement("audio");
    const unsupported = Boolean(probe && mime && probe.canPlayType(mime) === "");
    return { source: unsupported ? null : media, unsupported };
  }, [media]);
}
