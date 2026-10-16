/**
 * 앱 음성 녹음: expo-audio. iOS·안드로이드 모두 AAC(.m4a)로 녹음해 audio/mp4 로 보냅니다(옛 앱과 같은 설정).
 * 안드로이드의 LOW_QUALITY 기본값은 3GP/AMR 이라 브라우저(웹)에서 재생되지 않았습니다.
 * 한 채널 64kbps 면 30초가 약 240KB 라 서버 한도(데이터 URI 52만 자) 안에 들어갑니다.
 * 앱이 뒤로 가거나 대화방을 떠나면 녹음을 버립니다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  IOSOutputFormat,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from "expo-audio";
import { File } from "expo-file-system";
import { MAX_MEDIA_DATA_URI, VOICE_MAX_MS, VOICE_MIN_MS } from "../media";
import type { RecordingState, VoiceRecorder, VoiceTake } from "./types";

const VOICE_RECORDING: RecordingOptions = {
  ...RecordingPresets.LOW_QUALITY,
  extension: ".m4a",
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  android: { extension: ".m4a", outputFormat: "mpeg4", audioEncoder: "aac" },
  ios: { ...RecordingPresets.LOW_QUALITY.ios, extension: ".m4a", outputFormat: IOSOutputFormat.MPEG4AAC },
};

const playbackMode = () => setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);

export function useVoiceRecorder(): VoiceRecorder {
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const status = useAudioRecorderState(recorder, 200);
  const [state, setState] = useState<RecordingState>("idle");
  // finish 가 불릴 때의 길이(상태는 200ms 마다 갱신되므로 마지막 값을 들고 있습니다)
  const duration = useRef(0);
  useEffect(() => {
    duration.current = status.durationMillis;
  }, [status.durationMillis]);

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return "denied" as const;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState("recording");
      return "started" as const;
    } catch {
      await playbackMode();
      return "unavailable" as const;
    }
  }, [recorder]);

  const finish = useCallback(async (): Promise<VoiceTake | "too-short" | "too-long"> => {
    setState("finishing");
    const elapsed = duration.current;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri || elapsed < VOICE_MIN_MS) return "too-short";
      const media = `data:audio/mp4;base64,${await new File(uri).base64()}`;
      if (media.length > MAX_MEDIA_DATA_URI) return "too-long";
      return { media, durationMs: Math.min(elapsed, VOICE_MAX_MS) };
    } finally {
      await playbackMode();
      setState("idle");
    }
  }, [recorder]);

  const cancel = useCallback(() => {
    if (recorder.isRecording) void recorder.stop().catch(() => undefined);
    void playbackMode();
    setState("idle");
  }, [recorder]);

  // 앱이 뒤로 가면 녹음을 버립니다. 대화방을 떠날 때도 같습니다.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") cancel();
    });
    return () => {
      subscription.remove();
      if (recorder.isRecording) void recorder.stop().catch(() => undefined);
      void playbackMode();
    };
  }, [cancel, recorder]);

  return { state, durationMs: state === "recording" ? status.durationMillis : 0, start, finish, cancel };
}
