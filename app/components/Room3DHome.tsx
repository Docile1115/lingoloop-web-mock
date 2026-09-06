"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Minus, RotateCw, Trash2, Maximize, Save } from "lucide-react";
import { t } from "../lib/i18n";
import type { HomeData } from "../lib/home";
import type { Room3DConfig } from "../lib/room3d/config";
import type { Furnishing, Kind } from "../lib/room3d/models";
import type { RoomScene3D } from "../lib/room3d/scene";
import type { RoomItemId } from "../lib/room";

type Props = {
  data: HomeData;
  busy: boolean;
  suspended: boolean;
  onSave: (config: Room3DConfig, revision: number) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  onObject: (id: RoomItemId) => void;
};
export function Room3DHome({ data, busy, suspended, onSave, onDirtyChange, onObject }: Props) {
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<RoomScene3D | null>(null),
    callbacks = useRef({ onObject }),
    saving = useRef(false);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState<Furnishing | null>(null),
    [draft, setDraft] = useState<Furnishing[]>([]),
    [status, setStatus] = useState("idle"),
    [notice, setNotice] = useState("");
  const [baseline, setBaseline] = useState("");
  const mounted = useRef(true);
  const [discard, setDiscard] = useState(false);
  const saved = JSON.stringify(data.room3d?.items ?? null),
    own = data.own;
  const dirty = ready && own && JSON.stringify(draft) !== baseline;
  const names: Record<Kind, string> = {
    sofa: t("소파"),
    table: t("테이블"),
    desk: t("책상"),
    chair: t("의자"),
    shelf: t("책장"),
    plant: t("화분"),
    frame: t("액자"),
    board: t("화이트보드"),
    bed: t("침대"),
  };
  useEffect(() => {
    onDirtyChange(dirty);
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty || saving.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    Promise.all([import("../lib/room3d/scene"), import("../lib/room3d/models")])
      .then(([{ RoomScene3D }, { INITIAL_FURNITURE }]) => {
        if (cancelled || !host.current) return;
        setReady(false);
        setFailed(false);
        setEditing(false);
        setSelected(null);
        setNotice("");
        const items: Furnishing[] = JSON.parse(saved) ?? INITIAL_FURNITURE.map((item) => ({ ...item }));
        setBaseline(JSON.stringify(items));
        setDraft(items);
        try {
          scene.current = new RoomScene3D(
            host.current,
            {
              ready: () => setReady(true),
              error: () => setFailed(true),
              select: setSelected,
              layout: setDraft,
              status: setStatus,
              open: (item) => callbacks.current.onObject(item.id as RoomItemId),
            },
            { items, editable: own },
          );
        } catch {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [saved, own, retry]);
  useEffect(() => {
    scene.current?.setLocked(busy || suspended || discard);
  }, [busy, suspended, ready, discard]);
  const surfaces = JSON.stringify({
    photos: data.photos,
    notes: data.entries.map((entry) => entry.text),
    ids: data.room3d?.items.filter((item) => item.kind === "frame").map((item) => item.id) ?? ["frame"],
  });
  useEffect(() => {
    if (!ready || !scene.current) return;
    const active = scene.current;
    const value = JSON.parse(surfaces) as { photos: HomeData["photos"]; notes: string[]; ids: string[] };
    for (const id of value.ids) {
      active.resetPhoto(id);
      const photo = value.photos.find((row) => row.id === id);
      if (photo)
        void active.photo(id, photo.image).catch(() => {
          if (mounted.current) setNotice(t("사진을 읽을 수 없어요."));
        });
    }
    active.notes("whiteboard", value.notes.slice(0, 3).reverse());
  }, [ready, surfaces]);
  async function save() {
    if (saving.current || busy || !ready || discard) return;
    saving.current = true;
    scene.current?.setLocked(true);
    try {
      await onSave({ version: 1, items: draft }, data.room3dRevision ?? 0);
    } catch {
      if (mounted.current) setNotice(t("방을 저장하지 못했어요. 다시 시도해 주세요."));
    } finally {
      saving.current = false;
      if (mounted.current) scene.current?.setLocked(suspended);
    }
  }
  function open(item: Furnishing) {
    if (!data.room3d || dirty) {
      setNotice(t("3D 배치를 먼저 저장해 주세요."));
      return;
    }
    callbacks.current.onObject(item.id as RoomItemId);
  }
  useEffect(() => {
    callbacks.current = {
      onObject: (id) => {
        if (!data.room3d || dirty) {
          setNotice(t("3D 배치를 먼저 저장해 주세요."));
          return;
        }
        onObject(id);
      },
    };
  }, [onObject, data.room3d, dirty]);
  return (
    <section className="live-room3d">
      {dirty ? (
        <button type="button" disabled={busy} onClick={() => setDiscard(true)}>
          {t("변경 내용 버리기")}
        </button>
      ) : null}
      {discard ? (
        <div className="home-confirm" role="alert">
          <p>{t("저장하지 않은 방 변경 내용을 버릴까요?")}</p>
          <button type="button" disabled={busy} onClick={() => setDiscard(false)}>
            {t("계속 편집")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDiscard(false);
              setRetry((value) => value + 1);
            }}
          >
            {t("변경 내용 버리기")}
          </button>
        </div>
      ) : null}
      <div className="live-room3d-tools">
        <strong>3D HOME</strong>
        {own ? (
          <>
            <button
              type="button"
              disabled={busy || !ready || failed}
              aria-pressed={editing}
              onClick={() => {
                if (scene.current?.setEditing(!editing)) setEditing(!editing);
              }}
            >
              {editing ? t("생활 모드") : t("가구 배치")}
            </button>
            <button
              type="button"
              disabled={busy || !ready || failed || (!dirty && !!data.room3d)}
              onClick={() => void save()}
            >
              <Save size={16} />
              {busy ? t("저장 중…") : t("배치 저장")}
            </button>
          </>
        ) : null}
        <span>{t("캐릭터 외형은 동작 검증용 모델입니다.")}</span>
      </div>
      {!data.room3d && own ? (
        <p className="home-hint">{t("3D 배치를 저장하면 친구에게도 이 방이 보여요. 기존 2D 방은 보존됩니다.")}</p>
      ) : null}
      <div className="live-room3d-stage">
        <div className="live-room3d-canvas" ref={host} />
        <div className="live-room3d-camera">
          <button type="button" aria-label={t("확대")} onClick={() => scene.current?.zoom(0.85)}>
            <Plus size={18} />
          </button>
          <button type="button" aria-label={t("축소")} onClick={() => scene.current?.zoom(1.18)}>
            <Minus size={18} />
          </button>
          <button type="button" aria-label={t("시점 초기화")} onClick={() => scene.current?.resetCamera()}>
            <Maximize size={18} />
          </button>
        </div>
        {!ready || failed ? (
          <div className="live-room3d-loading" role="status">
            {failed ? (
              <>
                <p>{t("3D 화면을 불러오지 못했어요. WebGL을 지원하는 브라우저에서 다시 시도해주세요.")}</p>
                <button type="button" onClick={() => setRetry((v) => v + 1)}>
                  {t("다시 시도")}
                </button>
              </>
            ) : (
              t("방에 햇살을 들이는 중…")
            )}
          </div>
        ) : null}
      </div>
      <div className="room-object-actions">
        <span role="status">
          {status === "blocked"
            ? t("공간이 부족해요. 다른 위치를 골라주세요.")
            : status === "walking"
              ? t("걸어가는 중")
              : editing
                ? t("가구를 끌어서 배치하세요")
                : t("바닥을 누르면 이동하고, 가구를 누르면 다가가요.")}
        </span>
        {selected ? (
          <>
            <strong>{names[selected.kind]}</strong>
            {editing ? (
              <>
                <button type="button" disabled={busy} aria-label={t("회전")} onClick={() => scene.current?.rotate()}>
                  <RotateCw size={17} />
                </button>
                <button type="button" disabled={busy} aria-label={t("삭제")} onClick={() => scene.current?.remove()}>
                  <Trash2 size={17} />
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => (["frame", "board"].includes(selected.kind) ? open(selected) : scene.current?.action())}
              >
                {selected.kind === "frame"
                  ? t("사진")
                  : selected.kind === "board"
                    ? t("방명록")
                    : ["sofa", "chair"].includes(selected.kind)
                      ? status === "sitting"
                        ? t("일어나기")
                        : t("앉기")
                      : t("살펴보기")}
              </button>
            )}
          </>
        ) : null}
      </div>
      {notice ? (
        <p role="alert" className="home-hint">
          {notice}
        </p>
      ) : null}
      {editing ? (
        <div className="live-room3d-catalog">
          {(Object.keys(names) as Kind[]).map((kind) => (
            <button
              type="button"
              key={kind}
              disabled={
                busy ||
                draft.length >= 16 ||
                (kind === "frame" && draft.filter((i) => i.kind === "frame").length >= 3) ||
                (kind === "board" && draft.some((i) => i.kind === "board"))
              }
              onClick={() => scene.current?.add(kind)}
            >
              <Plus size={14} />
              {names[kind]}
            </button>
          ))}
        </div>
      ) : (
        <details>
          <summary>{t("가구 바로 선택")}</summary>
          <div className="live-room3d-catalog">
            {draft.map((item) => (
              <button type="button" key={item.id} disabled={busy || !ready} onClick={() => scene.current?.go(item.id)}>
                {names[item.kind]}
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
