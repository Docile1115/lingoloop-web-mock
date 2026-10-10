/**
 * 대화방.
 *
 * 시각 표기는 카카오톡 규칙을 따릅니다 — 같은 시간대의 말은 한 덩어리로 두고,
 * 30분이 지나거나 날짜가 바뀌면 다시 적습니다. 웹과 같은 규칙입니다.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  IOSOutputFormat,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { toChatMessage, type ApiCreateMessageResult, type ApiMessage } from "@shared/live-data";
import type { ChatMessage, Conversation } from "@shared/demo-data";
import { ApiError, api, get, post as apiPost } from "../lib/api";
import { useChats } from "../lib/chats";
import { clockOf, dayLabel, needsTimeMark } from "../lib/format";
import { msg, t, type MessageKey } from "../lib/i18n";
import { useSession } from "../lib/session";
import { useKeyboardOffset } from "../lib/useKeyboardOffset";
import { useTheme } from "../lib/useTheme";
import { radius, space, tapSize, type } from "../lib/theme";
import { EmptyState, HeaderButton, Loading, Sheet, SheetItem } from "../ui";
import { showToast } from "../ui/Toast";
import { acceptRequest, confirmDeclineRequest } from "./ChatsScreen";

type ConversationSupport = {
  topics: string[];
  suggestedOpeners: string[];
  followUpQuestions: string[];
  improvedDraft?: string;
  tip: string;
};

const MAX_MEDIA_DATA_URI = 520_000;
const voiceCacheUsers = new Map<string, number>();

/**
 * 음성 메시지 녹음 설정. iOS·안드로이드 모두 AAC(.m4a)로 녹음해 audio/mp4 로 보냅니다.
 * 안드로이드의 LOW_QUALITY 기본값은 3GP/AMR 이라 브라우저(웹)에서 재생되지 않았습니다.
 * 한 채널 64kbps 면 30초가 약 240KB 라 서버 한도(데이터 URI 52만 자) 안에 들어갑니다.
 */
const VOICE_RECORDING: RecordingOptions = {
  ...RecordingPresets.LOW_QUALITY,
  extension: ".m4a",
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  android: { extension: ".m4a", outputFormat: "mpeg4", audioEncoder: "aac" },
  ios: { ...RecordingPresets.LOW_QUALITY.ios, extension: ".m4a", outputFormat: IOSOutputFormat.MPEG4AAC },
};
const VOICE_MIME = "audio/mp4";

/** "data:audio/webm;codecs=opus;base64,..." 처럼 형식 뒤에 매개변수가 붙어도 읽습니다. */
const VOICE_DATA_URI = /^data:([^;,]+)((?:;[^;,]*)*);base64,(.+)$/s;

/** 캐시 파일 확장자. 재생기는 확장자로 형식을 짐작하므로 실제 형식과 맞춰야 합니다. */
function voiceExtension(mime: string): string {
  const kind = mime.trim().toLowerCase();
  if (kind.includes("3gpp")) return "3gp";
  if (kind.includes("webm")) return "webm";
  if (kind.includes("ogg")) return "ogg";
  if (kind === "audio/aac" || kind === "audio/x-aac") return "aac";
  if (kind.includes("mpeg") || kind.includes("mp3")) return "mp3";
  if (kind.includes("wav")) return "wav";
  // audio/mp4 · audio/m4a · audio/x-m4a
  return "m4a";
}

/** iOS 재생기(AVPlayer)는 WebM·Ogg(Opus)를 열지 못합니다. 크롬에서 녹음한 웹 음성이 그렇습니다. */
const playableHere = (extension: string) => Platform.OS !== "ios" || !["webm", "ogg"].includes(extension);

/** 신고 사유. 웹의 신고 창과 같은 목록입니다. 서버가 모르는 사유(개인정보 요구)는 기타로 접수합니다. */
const REPORT_REASONS: Array<[string, MessageKey]> = [
  ["spam", msg("스팸 또는 광고")],
  ["scam", msg("사기 · 금전 요구")],
  ["dating", msg("데이트·연애 목적")],
  ["harassment", msg("괴롭힘 또는 혐오 표현")],
  ["privacy", msg("개인정보 요구")],
  ["other", msg("기타")],
];
const SERVER_REPORT_REASONS = ["spam", "scam", "harassment", "dating", "other"];

/** 접수번호. 웹과 같은 모양으로 보여줍니다. */
const shortReportId = (id: string): string => `LL-${id.replace(/^report-/, "").slice(0, 8).toUpperCase()}`;

/** 대화방을 보는 동안 새 메시지를 받는 간격. */
const THREAD_POLL_MS = 12_000;

/** 같은 id 는 새 값으로 바꾸고 보낸 시각 순서로 둡니다. 내가 보낸 말이 갱신으로 또 와도 한 번만 보입니다. */
function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (!incoming.length) return current;
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => (a.sentAt ?? "").localeCompare(b.sentAt ?? ""));
}

function retainVoiceCache(uri: string) {
  voiceCacheUsers.set(uri, (voiceCacheUsers.get(uri) ?? 0) + 1);
}

function releaseVoiceCache(file: File) {
  const uri = file.uri;
  const remaining = Math.max(0, (voiceCacheUsers.get(uri) ?? 1) - 1);
  if (remaining) {
    voiceCacheUsers.set(uri, remaining);
    return;
  }
  voiceCacheUsers.delete(uri);
  // useAudioPlayer가 네이티브 player를 해제한 직후 파일을 지웁니다. Strict Mode가
  // 즉시 다시 붙이면 참조 수가 먼저 올라가므로 재생 중 파일은 삭제하지 않습니다.
  setTimeout(() => {
    if (voiceCacheUsers.has(uri)) return;
    try {
      if (file.exists) file.delete();
    } catch {
      // OS cache 정리는 best effort입니다.
    }
  }, 250);
}

function decodeBase64(value: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = value.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of clean) {
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

function voiceMediaKey(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function VoiceMessage({
  conversationId,
  id,
  media,
  mine,
  ink,
  muted,
}: {
  conversationId: string;
  id: string;
  media: string;
  mine: boolean;
  ink: string;
  muted: string;
}) {
  // 내 말풍선(초록) 위에는 흰색 대신 어두운 잉크를 씁니다. 흰색은 대비가 3.1:1 이라 기준(4.5:1)에 못 미칩니다.
  const onMine = useTheme().onPrimary;
  const [source, setSource] = useState<string | null>(media.startsWith("data:") ? null : media);
  const [unsupported, setUnsupported] = useState(false);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setUnsupported(false);
    if (!media.startsWith("data:")) {
      setSource(media);
      return;
    }
    let cachedFile: File | null = null;
    try {
      const match = VOICE_DATA_URI.exec(media);
      if (!match) return;
      const extension = voiceExtension(match[1]);
      if (!playableHere(extension)) {
        setUnsupported(true);
        setSource(null);
        return;
      }
      const payload = match[3];
      const safeConversationId = conversationId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "conversation";
      const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "message";
      // 같은 메시지 id의 media가 교체돼도 이전 파일을 재사용하지 않도록 payload
      // fingerprint를 이름에 넣습니다. 대화 id까지 포함되어 방 사이 충돌도 없습니다.
      const file = new File(
        Paths.cache,
        `timotalk-${safeConversationId}-${safeId}-${voiceMediaKey(payload)}.${extension}`,
      );
      if (!file.exists) {
        file.create({ overwrite: true, intermediates: true });
        file.write(decodeBase64(payload));
      }
      cachedFile = file;
      retainVoiceCache(file.uri);
      setSource(file.uri);
    } catch {
      setSource(null);
    }
    return () => {
      if (cachedFile) releaseVoiceCache(cachedFile);
    };
  }, [conversationId, id, media]);

  const toggle = async () => {
    if (!source) return;
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish) await player.seekTo(0);
    player.play();
  };

  if (unsupported) {
    return (
      <View style={styles.voiceMessage} accessible accessibilityLabel={t("이 기기에서는 재생할 수 없는 음성이에요.")}>
        <Ionicons name="volume-mute-outline" size={17} color={mine ? onMine : muted} />
        <Text style={{ color: mine ? onMine : muted, fontSize: 12, flexShrink: 1 }}>
          {t("이 기기에서는 재생할 수 없는 음성이에요.")}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => void toggle()}
      disabled={!source}
      accessibilityRole="button"
      accessibilityLabel={t("음성 메시지")}
      style={styles.voiceMessage}
    >
      <Ionicons name={status.playing ? "pause" : "play"} size={17} color={mine ? onMine : ink} />
      <View style={styles.voiceWave}>
        {[8, 14, 19, 11, 17, 9, 15].map((height, index) => (
          <View key={`${height}-${index}`} style={{ width: 2, height, borderRadius: 2, backgroundColor: mine ? onMine : muted }} />
        ))}
      </View>
      <Text style={{ color: mine ? onMine : muted, fontSize: 12 }}>
        {status.duration ? `${Math.ceil(status.duration)}s` : t("음성")}
      </Text>
    </Pressable>
  );
}

export function ThreadScreen({
  conversation,
  request = false,
  onClose,
}: {
  conversation: Conversation;
  /** 내가 받은 메시지 요청으로 열었는가. 수락하기 전에는 답장할 수 없습니다. */
  request?: boolean;
  /** 나가기·차단·요청 삭제 뒤 대화방을 닫습니다. */
  onClose: () => void;
}) {
  const c = useTheme();
  const keyboardOffset = useKeyboardOffset();
  const { me } = useSession();
  const navigation = useNavigation();
  const chats = useChats();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [sheet, setSheet] = useState<"menu" | "block" | "report" | null>(null);
  const [reportReason, setReportReason] = useState("spam");
  const [reportBlock, setReportBlock] = useState(false);
  const [acting, setActing] = useState(false);
  const actingNow = useRef(false);
  const [accepted, setAccepted] = useState(false);
  const [mutedOverride, setMutedOverride] = useState<boolean | null>(null);
  const known =
    chats.conversations.find((row) => row.id === conversation.id) ??
    chats.requests.find((row) => row.id === conversation.id);
  const incoming = !accepted && (request || chats.requests.some((row) => row.id === conversation.id));
  const muted = mutedOverride ?? known?.muted ?? conversation.muted ?? false;
  // 서버는 수락된 대화만 "나가기"를 받습니다. 대기 중인 요청은 삭제하거나 그대로 둡니다.
  const canLeave = !incoming && !chats.pendingIds.has(conversation.id);
  const name = conversation.name;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [support, setSupport] = useState<ConversationSupport | null>(null);
  const [supportDraft, setSupportDraft] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [error, setError] = useState("");
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const recorderState = useAudioRecorderState(recorder, 200);
  const stoppingRecording = useRef(false);
  const sendingNow = useRef(false);
  const mediaBusyNow = useRef(false);
  const coachRequestNow = useRef(false);
  const pendingMessage = useRef<{ signature: string; id: string } | null>(null);

  const [messageRows, setMessageRows] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadError, setLoadError] = useState("");
  /** 서버에서 받은 가장 최근 메시지 시각. 다음 갱신은 이것보다 새것만 받습니다. */
  const latestAt = useRef("");
  const fetching = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /**
   * 메시지 받기. 처음에는 최근 것을 통째로, 그 뒤로는 ?after= 로 새것만 받습니다.
   * 예전 서버는 after 를 모르고 최근 200개를 그대로 주는데, id 로 합치므로 결과는 같습니다.
   * 대화방을 여는 것만으로 서버가 읽음 처리합니다.
   */
  const fetchMessages = useCallback(async (initial = false) => {
    if (fetching.current) return;
    fetching.current = true;
    const after = initial ? "" : latestAt.current;
    try {
      const rows = await get<ApiMessage[]>(
        `/api/conversations/${encodeURIComponent(conversation.id)}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`,
      );
      if (!alive.current) return;
      for (const row of rows ?? []) {
        if (row.sentAt && row.sentAt > latestAt.current) latestAt.current = row.sentAt;
      }
      setMessageRows((current) => mergeMessages(current, (rows ?? []).map((row) => toChatMessage(row, me?.id ?? ""))));
      setLoadError("");
    } catch (caught) {
      // 주기적 갱신이 실패하면 조용히 넘기고 다음 차례에 다시 받습니다. 처음 받기만 알립니다.
      if (alive.current && initial) setLoadError(caught instanceof ApiError ? caught.message : t("불러오지 못했어요."));
    } finally {
      fetching.current = false;
      if (alive.current && initial) setLoadingMessages(false);
    }
  }, [conversation.id, me?.id]);

  useEffect(() => {
    void fetchMessages(true);
  }, [fetchMessages]);

  /* 대화방을 보는 동안 새 메시지를 주기적으로 받습니다(웹은 15초). 실시간 연결이 생기기 전까지의 방법입니다.
     앱이 다시 앞으로 오면 기다리지 않고 바로 받습니다. 다른 화면으로 가 있는 동안에는 멈춥니다. */
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        if (AppState.currentState === "active") void fetchMessages(latestAt.current === "");
      }, THREAD_POLL_MS);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void fetchMessages(latestAt.current === "");
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
      };
    }, [fetchMessages]),
  );

  /* 방금 연 대화(프로필에서 메시지 보내기)는 목록에 아직 없습니다. 한 번 다시 받아
     요청 상태(대기 중이면 나가기를 숨김)와 안읽음 수를 맞춥니다. */
  const checkedList = useRef(false);
  useEffect(() => {
    if (chats.loading || checkedList.current) return;
    checkedList.current = true;
    if (!known) void chats.reload();
  }, [chats, known]);

  /* 열어 둔 방은 서버가 읽음 처리합니다. 목록이 그 전에 받은 안읽음 수를 들고 있으면 배지에서 뺍니다. */
  const knownUnread = known?.unread ?? 0;
  useEffect(() => {
    if (!loadingMessages && knownUnread > 0) chats.update(conversation.id, { unread: 0 });
  }, [chats, conversation.id, knownUnread, loadingMessages]);

  const retryMessages = () => {
    setLoadingMessages(true);
    void fetchMessages(true);
  };

  /* 목록은 뒤집어 그립니다(inverted) — 새 말이 늘 바닥에 붙고, 처음 열 때도 타이머로
     맨 아래까지 굴릴 필요가 없습니다. 그래서 데이터도 최신이 앞에 오게 둡니다. */
  const newestFirst = useMemo(() => [...messageRows].reverse(), [messageRows]);

  const sendPayload = useCallback(async (
    payload: { text: string; type?: "text" | "image" | "voice"; media?: string },
    clearDraft = false,
  ) => {
    if (sendingNow.current) return false;
    sendingNow.current = true;
    setSending(true);
    setError("");
    const signature = JSON.stringify(payload);
    if (!pendingMessage.current || pendingMessage.current.signature !== signature) {
      pendingMessage.current = {
        signature,
        id: `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      };
    }
    try {
      const created = await apiPost<ApiCreateMessageResult>(
        `/api/conversations/${conversation.id}/messages`,
        {
          ...payload,
          clientMessageId: pendingMessage.current.id,
        },
      );
      // 보낸 시각을 latestAt 으로 쓰지 않습니다 — 그 사이 상대가 보낸 말을 다음 갱신에서 건너뛰게 됩니다.
      setMessageRows((rows) => mergeMessages(rows, [toChatMessage(created.message, me?.id ?? "")]));
      // 위로 올려 읽던 중이어도 방금 보낸 말이 보이게 바닥(뒤집힌 목록의 0)으로 갑니다.
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      pendingMessage.current = null;
      if (clearDraft) setDraft("");
      return true;
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
      return false;
    } finally {
      sendingNow.current = false;
      setSending(false);
    }
  }, [conversation.id, me?.id]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || mediaBusyNow.current) return;
    await sendPayload({ text, type: "text" }, true);
  }, [draft, sendPayload]);

  const pickPhoto = useCallback(async () => {
    if (mediaBusyNow.current) return;
    mediaBusyNow.current = true;
    setMediaBusy(true);
    setAttachOpen(false);
    setError("");
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];

      const compress = async (maxSide: number, quality: number) => {
        const context = ImageManipulator.manipulate(asset.uri);
        if (Math.max(asset.width, asset.height) > maxSide) {
          if (asset.width >= asset.height) context.resize({ width: maxSide });
          else context.resize({ height: maxSide });
        }
        const rendered = await context.renderAsync();
        return rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
      };

      let image = await compress(1280, 0.68);
      let media = image.base64 ? `data:image/jpeg;base64,${image.base64}` : "";
      if (media.length > MAX_MEDIA_DATA_URI) {
        image = await compress(960, 0.5);
        media = image.base64 ? `data:image/jpeg;base64,${image.base64}` : "";
      }
      if (!media || media.length > MAX_MEDIA_DATA_URI) {
        setError(t("사진을 줄여도 너무 커요. 다른 사진을 골라주세요."));
        return;
      }
      await sendPayload({ type: "image", text: t("사진"), media });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      mediaBusyNow.current = false;
      setMediaBusy(false);
    }
  }, [sendPayload]);

  const finishRecording = useCallback(async () => {
    if (stoppingRecording.current) return;
    stoppingRecording.current = true;
    mediaBusyNow.current = true;
    setMediaBusy(true);
    setError("");
    try {
      const duration = recorderState.durationMillis;
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri || duration < 400) return;
      if (duration > 30_500) {
        setError(t("녹음이 너무 길어요. 30초 안쪽으로 다시 녹음해 주세요."));
        return;
      }
      const file = new File(uri);
      const base64 = await file.base64();
      // 두 플랫폼 모두 AAC(.m4a)로 녹음하므로 형식을 하나로 보냅니다(서버·웹이 audio/mp4 를 받습니다).
      const media = `data:${VOICE_MIME};base64,${base64}`;
      if (media.length > MAX_MEDIA_DATA_URI) {
        setError(t("녹음이 너무 길어요. 30초 안쪽으로 다시 녹음해 주세요."));
        return;
      }
      await sendPayload({ type: "voice", text: t("음성 메시지"), media });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      mediaBusyNow.current = false;
      setMediaBusy(false);
      stoppingRecording.current = false;
    }
  }, [recorder, recorderState.durationMillis, sendPayload]);

  const startRecording = useCallback(async () => {
    if (sendingNow.current || mediaBusyNow.current || recorder.isRecording) return;
    setAttachOpen(false);
    setError("");
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError(t("마이크를 쓸 수 없어요. 설정에서 마이크 권한을 허용해 주세요."));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      setError(t("마이크를 쓸 수 없어요. 설정에서 마이크 권한을 허용해 주세요."));
    }
  }, [recorder]);

  useEffect(() => {
    if (recorderState.isRecording && recorderState.durationMillis >= 30_000) void finishRecording();
  }, [finishRecording, recorderState.durationMillis, recorderState.isRecording]);

  useEffect(() => {
    const discardRecording = () => {
      if (!recorder.isRecording || stoppingRecording.current) {
        void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
        return;
      }
      stoppingRecording.current = true;
      void recorder.stop()
        .catch(() => undefined)
        .finally(() => {
          stoppingRecording.current = false;
          void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
        });
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") discardRecording();
    });
    return () => {
      subscription.remove();
      discardRecording();
    };
  }, [conversation.id, recorder]);

  useEffect(() => {
    setSupport(null);
    setSupportDraft("");
    setCoachOpen(false);
    coachRequestNow.current = false;
    pendingMessage.current = null;
  }, [conversation.id]);

  const requestCoach = useCallback(async () => {
    if (!conversation.partnerId) {
      setError(t("이 대화에서는 코치를 쓸 수 없어요"));
      return;
    }
    if (coachRequestNow.current) return;
    coachRequestNow.current = true;
    setCoachLoading(true);
    setError("");
    const requestedDraft = draft.trim();
    try {
      const result = await apiPost<ConversationSupport>("/api/conversation-support", {
        partnerId: conversation.partnerId,
        draft: requestedDraft || undefined,
        stage: messageRows.length > 2 ? "ongoing" : "first-message",
      });
      setSupport(result);
      setSupportDraft(requestedDraft);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("대화 코치를 부르지 못했어요."));
    } finally {
      coachRequestNow.current = false;
      setCoachLoading(false);
    }
  }, [conversation.partnerId, draft, messageRows.length]);

  const toggleCoach = () => {
    if (!conversation.partnerId) {
      setError(t("이 대화에서는 코치를 쓸 수 없어요"));
      return;
    }
    const opening = !coachOpen;
    setCoachOpen(opening);
    if (opening && !support) void requestCoach();
  };

  /* 대화 메뉴(알림·나가기·차단·신고). 웹의 대화 메뉴와 같은 항목입니다. */
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton icon="ellipsis-horizontal" label={t("대화 메뉴")} onPress={() => setSheet("menu")} />
      ),
    });
  }, [navigation]);

  /** 서버에 보내는 동작은 한 번에 하나만. 두 번 눌러 같은 요청이 두 번 가지 않게 합니다. */
  const act = async (task: () => Promise<void>) => {
    if (actingNow.current) return;
    actingNow.current = true;
    setActing(true);
    try {
      await task();
    } finally {
      actingNow.current = false;
      setActing(false);
    }
  };

  const toggleMute = () => act(async () => {
    const next = !muted;
    setSheet(null);
    setMutedOverride(next);
    try {
      const result = await api<{ muted: boolean }>(
        `/api/conversations/${encodeURIComponent(conversation.id)}/mute`,
        { method: "PATCH", body: JSON.stringify({ muted: next }) },
      );
      setMutedOverride(result.muted);
      chats.update(conversation.id, { muted: result.muted });
      showToast(result.muted ? t("{name}님과의 알림을 껐어요", { name }) : t("{name}님과의 알림을 켰어요", { name }));
    } catch (caught) {
      setMutedOverride(!next);
      showToast(caught instanceof Error ? caught.message : t("설정을 저장하지 못했어요."));
    }
  });

  /** 나가도 대화와 메시지는 남습니다. 상대가 새 메시지를 보내면 다시 보입니다(서버 규칙). */
  const leave = () => act(async () => {
    setSheet(null);
    try {
      await api(`/api/conversations/${encodeURIComponent(conversation.id)}`, { method: "DELETE" });
      chats.remove(conversation.id);
      showToast(t("{name}님과의 대화방에서 나갔어요", { name }));
      onClose();
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : t("대화방에서 나가지 못했어요."));
    }
  });

  const blockPartner = async () => {
    if (!conversation.partnerId) return false;
    try {
      await api(`/api/partners/${encodeURIComponent(conversation.partnerId)}/block`, { method: "POST", body: "{}" });
      return true;
    } catch {
      return false;
    }
  };

  /** 서버에 차단이 확정된 뒤에만 방을 치웁니다. 실패하면 대화를 그대로 둡니다. */
  const block = () => act(async () => {
    setSheet(null);
    if (await blockPartner()) {
      chats.remove(conversation.id);
      showToast(t("{name}님을 차단하고 대화방에서 나갔어요", { name }));
      onClose();
    } else {
      showToast(t("차단하지 못했어요."));
    }
  });

  /**
   * 신고 접수. 운영자 화면으로 그대로 가므로 지어낸 값을 넣지 않습니다.
   * 함께 차단을 고르면 서버 차단까지 끝나야 "차단했어요"라고 알립니다.
   */
  const submitReport = () => act(async () => {
    if (!conversation.partnerId) {
      setSheet(null);
      showToast(t("이 대상은 신고할 수 없어요"));
      return;
    }
    try {
      const report = await apiPost<{ id: string }>("/api/reports", {
        targetType: "user",
        targetId: conversation.partnerId,
        reason: SERVER_REPORT_REASONS.includes(reportReason) ? reportReason : "other",
      });
      setSheet(null);
      const id = shortReportId(report.id);
      if (!reportBlock) {
        showToast(t("신고가 접수되었어요 · 접수번호 {id}", { id }));
        return;
      }
      if (await blockPartner()) {
        chats.remove(conversation.id);
        showToast(t("신고를 접수하고 {name}님을 차단했어요 · 접수번호 {id}", { name, id }));
        onClose();
      } else {
        showToast(t("신고는 접수했지만 차단하지 못했어요 · 접수번호 {id}", { id }));
      }
    } catch (caught) {
      setSheet(null);
      showToast(caught instanceof Error ? caught.message : t("신고를 접수하지 못했어요."));
    }
  });

  const accept = () => act(async () => {
    if (await acceptRequest(conversation.id, name)) {
      setAccepted(true);
      await chats.reload();
    }
  });

  const decline = () =>
    confirmDeclineRequest(conversation.id, name, () => {
      chats.remove(conversation.id);
      onClose();
    });

  if (loadingMessages) return <Loading />;

  const composerBusy = sending || mediaBusy || recorderState.isRecording;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboardOffset}
    >
      {/* 받은 메시지 요청. 수락하기 전에는 답장할 수 없고, 읽음·활동 상태도 상대에게 보이지 않습니다. */}
      {incoming ? (
        <View style={[styles.requestBanner, { backgroundColor: c.surfaceSoft, borderBottomColor: c.line }]}>
          <View style={styles.requestCopy}>
            <Ionicons name="shield-checkmark-outline" size={18} color={c.primaryStrong} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.name, { color: c.ink }]}>{t("{name}님의 메시지 요청", { name })}</Text>
              <Text style={[type.caption, { color: c.muted }]}>
                {t("수락하기 전까지 읽음 여부와 활동 상태가 상대에게 보이지 않아요.")}
              </Text>
            </View>
          </View>
          <View style={styles.requestActions}>
            <Pressable
              onPress={decline}
              disabled={acting}
              accessibilityRole="button"
              style={[styles.requestButton, { backgroundColor: c.sunken }]}
            >
              <Text style={{ color: c.ink, fontSize: 14, fontWeight: "700" }}>{t("삭제")}</Text>
            </Pressable>
            <Pressable
              onPress={() => void accept()}
              disabled={acting}
              accessibilityRole="button"
              style={[styles.requestButton, { backgroundColor: c.primary, opacity: acting ? 0.5 : 1 }]}
            >
              <Text style={{ color: c.onPrimary, fontSize: 14, fontWeight: "800" }}>{t("수락")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={newestFirst}
        inverted
        // 바닥 가까이 있으면 새 말을 따라 내려가고, 위로 올려 읽는 중이면 그 자리를 지킵니다.
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 40 }}
        keyExtractor={(row) => row.id}
        contentContainerStyle={messageRows.length ? styles.list : { flexGrow: 1 }}
        // 뒤집힌 목록은 빈 화면에 뒤집기 스타일을 덧입혀 바로 세웁니다. 스타일을 받는 View 로 감싸야 거꾸로 보이지 않습니다.
        ListEmptyComponent={
          <View style={{ flex: 1 }}>
            {loadError ? (
              <EmptyState title={loadError} onRetry={retryMessages} />
            ) : (
              <EmptyState
                title={t("첫 마디를 건네보세요")}
                body={t("짧아도 괜찮아요. 틀려도 괜찮아요.")}
              />
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          // 뒤집힌 목록이라 바로 앞(더 오래된) 말은 다음 칸에 있습니다.
          const previous = newestFirst[index + 1];
          // 서버가 시각을 안 주는 옛 메시지가 섞여 있을 수 있습니다.
          // 없으면 구분선도 시각도 그리지 않습니다 — 지어내지 않습니다.
          const sentAt = item.sentAt ?? "";
          const previousAt = previous?.sentAt ?? "";
          const newDay =
            Boolean(sentAt) &&
            (!previousAt ||
              new Date(sentAt).toDateString() !== new Date(previousAt).toDateString());
          const showTime = Boolean(sentAt) && needsTimeMark(sentAt, previousAt || undefined);
          return (
            <View>
              {newDay ? (
                <Text style={[styles.day, { color: c.subtle, backgroundColor: c.sunken }]}>
                  {dayLabel(sentAt)}
                </Text>
              ) : null}
              <View style={[styles.rowWrap, item.mine ? styles.mineWrap : styles.theirsWrap]}>
                {item.mine && showTime ? (
                  <Text style={[styles.stamp, { color: c.subtle }]}>{clockOf(sentAt)}</Text>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    item.mine
                      ? { backgroundColor: c.primaryStrong, borderBottomRightRadius: radius.xs }
                      : { backgroundColor: c.sunken, borderBottomLeftRadius: radius.xs },
                  ]}
                >
                  {item.kind === "image" && item.media ? (
                    <Image source={{ uri: item.media }} style={styles.messageImage} resizeMode="cover" accessibilityLabel={t("사진")} />
                  ) : item.kind === "voice" && item.media ? (
                    <VoiceMessage
                      conversationId={conversation.id}
                      id={item.id}
                      media={item.media}
                      mine={item.mine}
                      ink={c.ink}
                      muted={c.muted}
                    />
                  ) : (
                    <Text style={{ color: item.mine ? c.onPrimary : c.ink, fontSize: 15, lineHeight: 21 }}>
                      {item.text}
                    </Text>
                  )}
                </View>
                {!item.mine && showTime ? (
                  <Text style={[styles.stamp, { color: c.subtle }]}>{clockOf(sentAt)}</Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

      {coachOpen ? (
        <View style={[styles.coach, { backgroundColor: c.surfaceSoft, borderColor: c.line }]}>
          <View style={styles.coachHeader}>
            <View style={styles.coachTitle}>
              <Ionicons name="sparkles" size={16} color={c.primaryStrong} />
              <Text style={[type.name, { color: c.ink }]}>{t("대화 코치")}</Text>
            </View>
            <View style={styles.coachActions}>
              <Pressable onPress={() => void requestCoach()} disabled={coachLoading} accessibilityLabel={t("새로 추천")} style={styles.smallAction}>
                <Ionicons name="refresh" size={17} color={c.muted} />
              </Pressable>
              <Pressable onPress={() => setCoachOpen(false)} accessibilityLabel={t("대화 코치 닫기")} style={styles.smallAction}>
                <Ionicons name="close" size={19} color={c.muted} />
              </Pressable>
            </View>
          </View>
          {coachLoading ? (
            <Text style={[type.meta, { color: c.muted }]}>{t("대화 주제를 만드는 중…")}</Text>
          ) : support ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coachSuggestions}>
                {[...support.topics, ...support.suggestedOpeners, ...support.followUpQuestions].slice(0, 7).map((line) => (
                  <Pressable
                    key={line}
                    onPress={() => setDraft(line)}
                    disabled={composerBusy}
                    style={[styles.coachChip, { backgroundColor: c.surface, borderColor: c.line, opacity: composerBusy ? 0.5 : 1 }]}
                  >
                    <Text style={[type.meta, { color: c.ink }]} numberOfLines={2}>{line}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {support.improvedDraft && draft.trim() === supportDraft ? (
                <Pressable
                  onPress={() => setDraft(support.improvedDraft || "")}
                  disabled={composerBusy}
                  style={[styles.polishAction, { opacity: composerBusy ? 0.5 : 1 }]}
                >
                  <Ionicons name="sparkles-outline" size={15} color={c.primaryStrong} />
                  <Text style={[type.meta, { color: c.primaryStrong }]} numberOfLines={2}>{support.improvedDraft}</Text>
                </Pressable>
              ) : null}
              <Text style={[type.caption, { color: c.muted }]} numberOfLines={2}>{support.tip}</Text>
            </>
          ) : (
            <Pressable onPress={() => void requestCoach()}>
              <Text style={[type.meta, { color: c.primaryStrong }]}>{t("새로 추천")}</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {recorderState.isRecording ? (
        <Text style={[styles.recordingStatus, { color: c.danger }]}>
          {t("녹음 중이에요. 다시 누르면 보내요.")} · {Math.min(30, Math.floor(recorderState.durationMillis / 1000))}s
        </Text>
      ) : null}

      {attachOpen && !composerBusy ? (
        <>
          <Pressable style={styles.scrim} onPress={() => setAttachOpen(false)} accessibilityLabel={t("닫기")} />
          <View style={[styles.attachMenu, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Pressable
              style={styles.attachItem}
              onPress={() => void pickPhoto()}
              disabled={composerBusy}
              accessibilityRole="menuitem"
            >
              <Ionicons name="image-outline" size={18} color={c.ink} />
              <Text style={[type.body, { color: c.ink }]}>{t("사진")}</Text>
            </Pressable>
            <Pressable
              style={styles.attachItem}
              onPress={() => void startRecording()}
              disabled={composerBusy}
              accessibilityRole="menuitem"
            >
              <Ionicons name="mic-outline" size={18} color={c.ink} />
              <Text style={[type.body, { color: c.ink }]}>{t("음성")}</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {/* 웹과 같은 배치입니다 — 첨부는 칸 밖 왼쪽, 코치는 칸 안 왼쪽,
          보내기는 칸 안 오른쪽에 쓸 것이 있을 때만.
          ＋ 와 칸의 한 줄 높이를 COMPOSER_H 하나로 묶습니다. 높이가 다르면
          바닥만 맞고 중심이 몇 px 어긋납니다.
          받은 요청은 수락하기 전에는 답장할 수 없으므로(서버 규칙) 입력칸을 두지 않습니다. */}
      {incoming ? null : (
      <View style={[styles.composer, { borderTopColor: c.line, backgroundColor: c.surface }]}>
        <Pressable
          onPress={() => recorderState.isRecording ? void finishRecording() : setAttachOpen((open) => !open)}
          disabled={sending || mediaBusy}
          accessibilityRole="button"
          accessibilityLabel={recorderState.isRecording ? t("녹음 멈추기") : t("첨부")}
          style={({ pressed }) => [
            styles.round,
            {
              backgroundColor: recorderState.isRecording ? c.danger : attachOpen ? c.primary : c.sunken,
              opacity: sending || mediaBusy ? 0.45 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons
            name={recorderState.isRecording ? "stop" : "add"}
            size={24}
            color={recorderState.isRecording ? "#ffffff" : attachOpen ? c.onPrimary : c.ink}
          />
        </Pressable>

        <View style={[styles.field, { backgroundColor: c.sunken, borderColor: c.line }]}>
          {/* 이모지는 기기 키보드의 이모지 자판을 씁니다. 😊 하나만 붙이던 단추는 뺐습니다. */}
          <Pressable
            onPress={toggleCoach}
            disabled={composerBusy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("대화 코치")}
            style={styles.inlineAction}
          >
            <Ionicons name="sparkles-outline" size={19} color={coachOpen ? c.primaryStrong : c.muted} />
          </Pressable>

          <TextInput
            style={[styles.input, { color: c.ink }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={t("메시지 보내기")}
            placeholderTextColor={c.subtle}
            multiline
            maxLength={2000}
            editable={!composerBusy}
          />

          {/* 쓸 것이 있을 때만. 다른 안쪽 버튼과 같은 크기라 줄이 흔들리지 않습니다. */}
          {draft.trim() ? (
            <Pressable
              onPress={() => void send()}
              disabled={composerBusy}
              accessibilityRole="button"
              accessibilityLabel={t("보내기")}
              style={({ pressed }) => [
                styles.inlineSend,
                { backgroundColor: c.primary, opacity: composerBusy ? 0.45 : pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="arrow-up" size={20} color={c.onPrimary} />
            </Pressable>
          ) : null}
        </View>
      </View>
      )}

      {/* 메뉴·차단 확인·신고는 시트 하나에서 내용만 바꿉니다(iOS 는 Modal 을 겹쳐 열 수 없습니다). */}
      <Sheet
        visible={sheet !== null}
        onClose={() => { if (!acting) setSheet(null); }}
        title={sheet === "report" ? t("안전하게 이용할 수 있도록 도와주세요") : sheet === "block" ? t("이 사용자를 차단할까요?") : name}
      >
        {sheet === "menu" ? (
          <>
            <SheetItem
              icon={muted ? "notifications-outline" : "notifications-off-outline"}
              label={muted ? t("알림 켜기") : t("알림 끄기")}
              disabled={acting}
              onPress={() => void toggleMute()}
            />
            {canLeave ? (
              <SheetItem icon="exit-outline" label={t("대화방 나가기")} disabled={acting} onPress={() => void leave()} />
            ) : null}
            <SheetItem icon="ban-outline" label={t("차단하기")} danger disabled={acting} onPress={() => setSheet("block")} />
            <SheetItem icon="flag-outline" label={t("신고하기")} danger disabled={acting} onPress={() => setSheet("report")} />
            <SheetItem label={t("취소")} onPress={() => setSheet(null)} />
          </>
        ) : sheet === "block" ? (
          <>
            <Text style={[type.meta, { color: c.muted, paddingHorizontal: space.sm }]}>
              {t("프로필과 메시지가 서로 보이지 않아요.")}
            </Text>
            <SheetItem icon="ban-outline" label={t("차단")} danger disabled={acting} onPress={() => void block()} />
            <SheetItem label={t("취소")} disabled={acting} onPress={() => setSheet(null)} />
          </>
        ) : sheet === "report" ? (
          <>
            <Text style={[type.meta, { color: c.muted, paddingHorizontal: space.sm }]}>
              <Text style={{ fontWeight: "700", color: c.ink }}>{name}</Text>
              {t("을(를) 신고하거나 차단할 수 있어요. 신고 내용은 상대에게 알려지지 않습니다.")}
            </Text>
            {REPORT_REASONS.map(([id, label]) => (
              <SheetItem
                key={id}
                label={t(label)}
                selected={reportReason === id}
                disabled={acting}
                onPress={() => setReportReason(id)}
              />
            ))}
            <View style={styles.reportBlock}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.body, { color: c.ink }]}>{t("이 사용자도 함께 차단")}</Text>
                <Text style={[type.caption, { color: c.muted }]}>{t("프로필과 메시지가 서로 보이지 않아요.")}</Text>
              </View>
              <Switch
                value={reportBlock}
                onValueChange={setReportBlock}
                disabled={acting}
                accessibilityLabel={t("이 사용자도 함께 차단")}
                trackColor={{ true: c.primary, false: c.lineStrong }}
              />
            </View>
            <Text style={[type.caption, { color: c.muted, paddingHorizontal: space.sm }]}>
              {t("신고했다는 이유만으로 계정을 정지하지 않으며, 자동 제재 없이 안전팀이 맥락을 검토해요.")}
            </Text>
            <View style={styles.reportActions}>
              <Pressable
                onPress={() => setSheet(null)}
                disabled={acting}
                accessibilityRole="button"
                style={[styles.reportButton, { backgroundColor: c.sunken }]}
              >
                <Text style={{ color: c.ink, fontSize: 15, fontWeight: "700" }}>{t("취소")}</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitReport()}
                disabled={acting}
                accessibilityRole="button"
                style={[styles.reportButton, { backgroundColor: c.danger, opacity: acting ? 0.5 : 1 }]}
              >
                <Text style={{ color: c.bg, fontSize: 15, fontWeight: "800" }}>{t("신고 보내기")}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

/* 컴포저 한 줄 높이. 안쪽 아이콘(30) + 위아래 여백(9+9) + 테두리 = 50.
   웹의 --composer-h 와 같은 값입니다. */
const COMPOSER_H = 50;

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: 3 },
  day: {
    alignSelf: "center",
    marginVertical: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    fontSize: 12,
    overflow: "hidden",
  },
  rowWrap: { flexDirection: "row", alignItems: "flex-end", gap: space.xs },
  mineWrap: { justifyContent: "flex-end" },
  theirsWrap: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", paddingHorizontal: space.md, paddingVertical: 9, borderRadius: radius.lg, overflow: "hidden" },
  messageImage: { width: 220, height: 220, marginHorizontal: -space.md, marginVertical: -9 },
  voiceMessage: { minWidth: 154, minHeight: 30, flexDirection: "row", alignItems: "center", gap: space.sm },
  voiceWave: { flex: 1, minWidth: 78, height: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stamp: { fontSize: 11, marginBottom: 2 },
  error: { fontSize: 13, paddingHorizontal: space.lg, paddingBottom: space.xs },
  coach: { marginHorizontal: space.md, marginBottom: space.xs, padding: space.md, gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md },
  coachHeader: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  coachTitle: { flexDirection: "row", alignItems: "center", gap: space.xs },
  coachActions: { flexDirection: "row", alignItems: "center", gap: space.xs },
  smallAction: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  coachSuggestions: { gap: space.sm, paddingRight: space.md },
  coachChip: { width: 190, minHeight: 52, justifyContent: "center", paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.button },
  polishAction: { flexDirection: "row", alignItems: "center", gap: space.xs },
  recordingStatus: { paddingHorizontal: space.lg, paddingVertical: space.xs, fontSize: 13, fontWeight: "600" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    padding: space.sm,
    paddingHorizontal: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  /* ＋·보내기. 칸의 한 줄 높이와 같아야 바닥 정렬이 곧 중앙 정렬이 됩니다. */
  round: {
    width: COMPOSER_H,
    height: COMPOSER_H,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  field: {
    flex: 1,
    minHeight: COMPOSER_H,
    maxHeight: 132,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
  },
  input: { flex: 1, minHeight: 34, paddingTop: 6, paddingBottom: 6, paddingHorizontal: space.xs, fontSize: 15, lineHeight: 22 },
  inlineAction: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  /* 다른 안쪽 버튼과 같은 크기라 글을 쓰기 시작해도 줄이 흔들리지 않습니다. */
  inlineSend: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, marginLeft: 2 },
  scrim: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  attachMenu: {
    position: "absolute",
    left: space.md,
    bottom: COMPOSER_H + space.md + 6,
    minWidth: 148,
    padding: space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    zIndex: 11,
  },
  attachItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 40,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  requestBanner: { gap: space.sm, padding: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  requestCopy: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  requestActions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
  requestButton: { minHeight: tapSize, minWidth: 76, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  reportBlock: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.sm, paddingVertical: space.sm },
  reportActions: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  reportButton: { flex: 1, minHeight: tapSize + 4, alignItems: "center", justifyContent: "center", borderRadius: radius.button },
});
