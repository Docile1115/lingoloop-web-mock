/**
 * 음성 녹음·재생의 약속. 웹(.web.ts)과 앱(.native.ts)이 같은 모양을 지킵니다.
 */
export type RecordingState = "idle" | "recording" | "finishing";

/** 녹음을 마친 결과. 서버에 그대로 보낼 데이터 URI 입니다. */
export type VoiceTake = { media: string; durationMs: number };

export type VoiceRecorder = {
  state: RecordingState;
  durationMs: number;
  /** 마이크를 열고 녹음을 시작합니다. 권한이 없으면 "denied", 기기·브라우저가 못 하면 "unavailable". */
  start: () => Promise<"started" | "denied" | "unavailable">;
  /** 녹음을 멈추고 결과를 줍니다. 너무 짧거나(실수로 누름) 서버 한도를 넘으면 그 이유를 줍니다. */
  finish: () => Promise<VoiceTake | "too-short" | "too-long">;
  /** 녹음을 버립니다(마이크도 놓습니다). */
  cancel: () => void;
};

/** 재생할 소리. 이 기기가 그 형식을 못 틀면 unsupported 입니다(iOS·사파리는 크롬에서 녹음한 webm/ogg 를 못 틉니다). */
export type VoiceSource = { source: string | null; unsupported: boolean };
