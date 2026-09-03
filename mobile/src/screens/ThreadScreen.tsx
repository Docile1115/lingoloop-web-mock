/**
 * 대화방.
 *
 * 시각 표기는 카카오톡 규칙을 따릅니다 — 같은 시간대의 말은 한 덩어리로 두고,
 * 30분이 지나거나 날짜가 바뀌면 다시 적습니다. 웹과 같은 규칙입니다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { toChatMessage, type ApiCreateMessageResult, type ApiMessage } from "@shared/live-data";
import type { ChatMessage, Conversation } from "@shared/demo-data";
import { ApiError, post as apiPost } from "../lib/api";
import { clockOf, dayLabel, needsTimeMark } from "../lib/format";
import { t } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/useTheme";
import { radius, space, type } from "../lib/theme";
import { EmptyState, Loading } from "../ui";

type ConversationSupport = {
  topics: string[];
  suggestedOpeners: string[];
  followUpQuestions: string[];
  improvedDraft?: string;
  tip: string;
};

const MAX_MEDIA_DATA_URI = 520_000;
const voiceCacheUsers = new Map<string, number>();

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
  const [source, setSource] = useState<string | null>(media.startsWith("data:") ? null : media);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (!media.startsWith("data:")) {
      setSource(media);
      return;
    }
    let cachedFile: File | null = null;
    try {
      const match = /^data:([^;]+);base64,(.+)$/s.exec(media);
      if (!match) return;
      const extension = match[1].includes("3gpp") ? "3gp" : match[1].includes("webm") ? "webm" : "m4a";
      const safeConversationId = conversationId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "conversation";
      const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "message";
      // 같은 메시지 id의 media가 교체돼도 이전 파일을 재사용하지 않도록 payload
      // fingerprint를 이름에 넣습니다. 대화 id까지 포함되어 방 사이 충돌도 없습니다.
      const file = new File(
        Paths.cache,
        `timotalk-${safeConversationId}-${safeId}-${voiceMediaKey(match[2])}.${extension}`,
      );
      if (!file.exists) {
        file.create({ overwrite: true, intermediates: true });
        file.write(decodeBase64(match[2]));
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

  return (
    <Pressable
      onPress={() => void toggle()}
      disabled={!source}
      accessibilityRole="button"
      accessibilityLabel={t("음성 메시지")}
      style={styles.voiceMessage}
    >
      <Ionicons name={status.playing ? "pause" : "play"} size={17} color={mine ? "#ffffff" : ink} />
      <View style={styles.voiceWave}>
        {[8, 14, 19, 11, 17, 9, 15].map((height, index) => (
          <View key={`${height}-${index}`} style={{ width: 2, height, borderRadius: 2, backgroundColor: mine ? "#ffffff" : muted }} />
        ))}
      </View>
      <Text style={{ color: mine ? "#ffffff" : muted, fontSize: 12 }}>
        {status.duration ? `${Math.ceil(status.duration)}s` : t("음성")}
      </Text>
    </Pressable>
  );
}

export function ThreadScreen({ conversation }: { conversation: Conversation }) {
  const c = useTheme();
  const { me } = useSession();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [support, setSupport] = useState<ConversationSupport | null>(null);
  const [supportDraft, setSupportDraft] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [error, setError] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const stoppingRecording = useRef(false);
  const sendingNow = useRef(false);
  const mediaBusyNow = useRef(false);
  const coachRequestNow = useRef(false);
  const pendingMessage = useRef<{ signature: string; id: string } | null>(null);

  const messages = useApi<ChatMessage[]>(
    `/api/conversations/${conversation.id}/messages`,
    [],
    (raw: ApiMessage[]) => raw.map((row) => toChatMessage(row, me?.id ?? "")),
  );

  // 새 말이 오면 바닥으로. 보내고 나서 위쪽만 보이면 보낸 게 안 보입니다.
  useEffect(() => {
    if (!messages.data.length) return;
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.data.length]);

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
      messages.set((rows) => [...rows, toChatMessage(created.message, me?.id ?? "")]);
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
  }, [conversation.id, me?.id, messages]);

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
      const mime = file.extension === ".3gp" ? "audio/3gpp" : file.extension === ".webm" ? "audio/webm" : "audio/mp4";
      const media = `data:${mime};base64,${base64}`;
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
        setError(t("마이크를 쓸 수 없어요. 브라우저 권한을 확인해 주세요."));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      setError(t("마이크를 쓸 수 없어요. 브라우저 권한을 확인해 주세요."));
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
        stage: messages.data.length > 2 ? "ongoing" : "first-message",
      });
      setSupport(result);
      setSupportDraft(requestedDraft);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("대화 코치를 부르지 못했어요."));
    } finally {
      coachRequestNow.current = false;
      setCoachLoading(false);
    }
  }, [conversation.partnerId, draft, messages.data.length]);

  const toggleCoach = () => {
    if (!conversation.partnerId) {
      setError(t("이 대화에서는 코치를 쓸 수 없어요"));
      return;
    }
    const opening = !coachOpen;
    setCoachOpen(opening);
    if (opening && !support) void requestCoach();
  };

  if (messages.loading) return <Loading />;

  const composerBusy = sending || mediaBusy || recorderState.isRecording;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages.data}
        keyExtractor={(row) => row.id}
        contentContainerStyle={messages.data.length ? styles.list : { flexGrow: 1 }}
        ListEmptyComponent={
          messages.error ? (
            <EmptyState title={messages.error} onRetry={messages.refresh} />
          ) : (
            <EmptyState
              title={t("첫 마디를 건네보세요")}
              body={t("짧아도 괜찮아요. 틀려도 괜찮아요.")}
            />
          )
        }
        renderItem={({ item, index }) => {
          const previous = messages.data[index - 1];
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
                    <Text style={{ color: item.mine ? "#ffffff" : c.ink, fontSize: 15, lineHeight: 21 }}>
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

      {/* 웹과 같은 배치입니다 — 첨부는 칸 밖 왼쪽, 이모지·코치는 칸 안 왼쪽,
          보내기는 칸 안 오른쪽에 쓸 것이 있을 때만.
          ＋ 와 칸의 한 줄 높이를 COMPOSER_H 하나로 묶습니다. 높이가 다르면
          바닥만 맞고 중심이 몇 px 어긋납니다. */}
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
          <Pressable
            onPress={() => setDraft((text) => `${text} 😊`)}
            disabled={composerBusy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("이모지")}
            style={styles.inlineAction}
          >
            <Ionicons name="happy-outline" size={20} color={c.muted} />
          </Pressable>
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
});
