/**
 * 웹 음성 녹음: MediaRecorder 를 직접 씁니다.
 * expo-audio 의 웹 녹음기는 녹음을 멈춰도 마이크 스트림을 닫지 않아 브라우저의 "녹음 중" 표시가 남습니다.
 * 여기서는 멈추거나 버리거나 화면을 떠나면 마이크 트랙을 모두 닫습니다.
 *
 * 형식은 브라우저가 녹음할 수 있는 것 중 먼저 맞는 것: 크롬·엣지 webm/opus, 사파리 mp4, 파이어폭스 ogg/opus.
 * 32kbps 면 30초가 약 120KB 라 서버 한도(데이터 URI 52만 자) 안에 넉넉히 들어갑니다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_MEDIA_DATA_URI, VOICE_MAX_MS, VOICE_MIN_MS } from "../media";
import type { RecordingState, VoiceRecorder, VoiceTake } from "./types";

const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

export function useVoiceRecorder(): VoiceRecorder {
  const [state, setState] = useState<RecordingState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 시계를 멈추고 마이크를 놓습니다. */
  const release = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    recorder.current = null;
  }, []);

  // 대화방을 떠나면 녹음 중이던 것도 버리고 마이크를 놓습니다.
  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    },
    [release],
  );

  const start = useCallback(async () => {
    if (recorder.current) return "unavailable" as const;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return "unavailable" as const;
    }
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return "denied" as const;
    }
    const mimeType = PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const next = new MediaRecorder(media, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 });
    chunks.current = [];
    next.addEventListener("dataavailable", (event) => {
      if (event.data.size) chunks.current.push(event.data);
    });
    stream.current = media;
    recorder.current = next;
    next.start();
    startedAt.current = Date.now();
    setDurationMs(0);
    setState("recording");
    ticker.current = setInterval(() => setDurationMs(Date.now() - startedAt.current), 200);
    return "started" as const;
  }, []);

  const finish = useCallback(async (): Promise<VoiceTake | "too-short" | "too-long"> => {
    const current = recorder.current;
    if (!current) return "too-short";
    setState("finishing");
    const elapsed = Date.now() - startedAt.current;
    const blob = await new Promise<Blob>((resolve) => {
      current.addEventListener(
        "stop",
        () => resolve(new Blob(chunks.current, { type: current.mimeType || chunks.current[0]?.type || "audio/webm" })),
        { once: true },
      );
      current.stop();
    });
    release();
    setState("idle");
    setDurationMs(0);
    if (elapsed < VOICE_MIN_MS || !blob.size) return "too-short";
    const media = await blobToDataUri(blob);
    if (media.length > MAX_MEDIA_DATA_URI) return "too-long";
    return { media, durationMs: Math.min(elapsed, VOICE_MAX_MS) };
  }, [release]);

  const cancel = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    chunks.current = [];
    release();
    setState("idle");
    setDurationMs(0);
  }, [release]);

  return { state, durationMs, start, finish, cancel };
}
