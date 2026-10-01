"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageIcon, LayoutGrid, Maximize, MessageSquareText, Minus, Plus, RotateCw, Save, Trash2, X } from "lucide-react";
import { t } from "../lib/i18n";
import type { HomeData } from "../lib/home";
import type { Room3DConfig } from "../lib/room3d/config";
import type { AvatarKind } from "../lib/room3d/avatar";
import type { Furnishing, Kind } from "../lib/room3d/models";
import type { RoomScene3D } from "../lib/room3d/scene";

export type HomeDockAction = { key: string; label: string; icon: ReactNode; onClick: () => void; disabled?: boolean };
type Status = "idle" | "walking" | "sitting" | "blocked" | "editing";
type Props = {
  data: HomeData;
  busy: boolean;
  /** A sheet or confirmation floats over the room: input is locked and room controls step aside. */
  suspended: boolean;
  onSave: (config: Room3DConfig, revision: number) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  /** The resident reached a frame or the whiteboard (or a shortcut asked for one). */
  onObject: (id: string) => void;
  /** VRM avatar shown as the resident (the viewer's own character). */
  avatar?: AvatarKind;
  /** Dialog-owned overlays: whose home this is (top left) and window buttons (top right). */
  heading: ReactNode;
  windowActions: ReactNode;
  /** Dialog-owned shortcuts listed after the room's own ones (gifts, chat, settings). */
  dock: HomeDockAction[];
  /** Panels and messages that float over the room. */
  children?: ReactNode;
};

const TURN = 2 * Math.PI;
/** Same furniture in the same places, ignoring float noise and how a rotation is written (the server stores [0, 2π)). */
function sameLayout(a: readonly Furnishing[], b: readonly Furnishing[]) {
  return (
    a.length === b.length &&
    a.every((item, index) => {
      const other = b[index],
        angle = (((item.rotation - other.rotation) % TURN) + TURN) % TURN;
      return (
        other.id === item.id &&
        other.kind === item.kind &&
        Math.abs(other.x - item.x) < 1e-6 &&
        Math.abs(other.z - item.z) < 1e-6 &&
        Math.min(angle, TURN - angle) < 1e-6
      );
    })
  );
}

/**
 * The whole home is one 3D room; every control floats inside it like a game HUD
 * instead of being stacked above and below the canvas.
 */
export function Room3DHome({ data, busy, suspended, onSave, onDirtyChange, onObject, avatar, heading, windowActions, dock, children }: Props) {
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<RoomScene3D | null>(null),
    saving = useRef(false),
    mounted = useRef(true);
  const [ready, setReady] = useState(false),
    [progress, setProgress] = useState(0),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState<Furnishing | null>(null),
    [draft, setDraft] = useState<Furnishing[]>([]),
    [baseline, setBaseline] = useState<Furnishing[]>([]),
    [status, setStatus] = useState<Status>("idle"),
    [notice, setNotice] = useState(""),
    [discard, setDiscard] = useState(false);
  const own = data.own;
  /* Rebuild the scene only when the server layout differs from what is on screen.
     After the owner's own save they match, so the room does not flash a loading screen. */
  const savedKey = JSON.stringify(data.room3d?.items ?? null);
  const [seenKey, setSeenKey] = useState(savedKey);
  const [buildKey, setBuildKey] = useState(savedKey);
  if (savedKey !== seenKey) {
    setSeenKey(savedKey);
    if (data.room3d && ready && sameLayout(data.room3d.items, draft)) setBaseline(data.room3d.items);
    else setBuildKey(savedKey);
  }
  const dirty = ready && own && !sameLayout(draft, baseline);
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
  const callbacks = useRef({ open: (id: string) => onObject(id) });
  useEffect(() => {
    callbacks.current = {
      open: (id) => {
        // Photos and notes belong to saved furniture; an unsaved layout may not have it yet.
        if (dirty) {
          setNotice(t("3D 배치를 먼저 저장해 주세요."));
          return;
        }
        onObject(id);
      },
    };
  }, [onObject, dirty]);
  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    Promise.all([import("../lib/room3d/scene"), import("../lib/room3d/models")])
      .then(([{ RoomScene3D }, { INITIAL_FURNITURE }]) => {
        if (cancelled || !host.current) return;
        setReady(false);
        setProgress(0);
        setFailed(false);
        setEditing(false);
        setSelected(null);
        setNotice("");
        // Without a saved layout everyone sees the starter room (owner and visitors alike).
        const items: Furnishing[] = (JSON.parse(buildKey) as Furnishing[] | null) ?? INITIAL_FURNITURE.map((item) => ({ ...item }));
        setBaseline(items);
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
              open: (item) => callbacks.current.open(item.id),
              // 2% steps: unchanged values skip the re-render.
              progress: (fraction) => setProgress(Math.round(fraction * 50) / 50),
            },
            { items, editable: own, avatar },
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
  }, [buildKey, own, retry, avatar]);
  useEffect(() => {
    scene.current?.setLocked(busy || suspended || discard);
  }, [busy, suspended, ready, discard]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);
  // Photos and the latest guestbook notes are painted onto the frames and the whiteboard.
  const frameIds = draft.filter((item) => item.kind === "frame").map((item) => item.id).join(",");
  const notes = JSON.stringify(data.entries.slice(0, 3).map((entry) => entry.text).reverse());
  useEffect(() => {
    if (!ready || !scene.current) return;
    const active = scene.current;
    for (const id of frameIds.split(",").filter(Boolean)) {
      active.resetPhoto(id);
      const photo = data.photos.find((row) => row.id === id);
      if (photo)
        void active.photo(id, photo.image).catch(() => {
          if (mounted.current) setNotice(t("사진을 읽을 수 없어요."));
        });
    }
    active.notes("whiteboard", JSON.parse(notes) as string[]);
  }, [ready, frameIds, data.photos, notes]);
  const startEditing = () => {
    if (scene.current?.setEditing(true)) setEditing(true);
  };
  const stopEditing = () => {
    if (dirty) setDiscard(true);
    else if (scene.current?.setEditing(false)) setEditing(false);
  };
  async function save() {
    if (saving.current || busy || !ready || discard) return;
    saving.current = true;
    scene.current?.setLocked(true);
    try {
      if (await onSave({ version: 1, items: draft }, data.room3dRevision ?? 0)) {
        scene.current?.setEditing(false);
        if (mounted.current) setEditing(false);
      }
    } catch {
      if (mounted.current) setNotice(t("방을 저장하지 못했어요. 다시 시도해 주세요."));
    } finally {
      saving.current = false;
      if (mounted.current) scene.current?.setLocked(suspended);
    }
  }
  /** Dock shortcut: walk to the whiteboard or a frame first, so things still happen in the room. */
  const visit = (kind: "board" | "frame") => {
    const item = draft.find((row) => row.kind === kind);
    if (!item) {
      if (own) {
        if (scene.current?.setEditing(true)) {
          setEditing(true);
          scene.current.add(kind);
        }
        setNotice(
          kind === "board"
            ? t("화이트보드를 놓고 배치를 저장하면 방명록을 받을 수 있어요.")
            : t("액자를 놓고 배치를 저장하면 사진을 걸 수 있어요."),
        );
      } else if (kind === "board") onObject("whiteboard");
      else setNotice(t("아직 걸어둔 사진이 없어요."));
      return;
    }
    if (dirty) {
      setNotice(t("3D 배치를 먼저 저장해 주세요."));
      return;
    }
    // If the way is blocked, open it right away rather than doing nothing.
    if (!scene.current?.go(item.id)) callbacks.current.open(item.id);
  };
  const statusText = {
    idle: t("바닥을 누르면 이동하고, 가구를 누르면 다가가요."),
    walking: t("걸어가는 중"),
    sitting: t("편안히 쉬는 중"),
    blocked: editing ? t("공간이 부족해요. 다른 위치를 골라주세요.") : t("거기로는 갈 수 없어요."),
    editing: t("가구를 끌어서 배치하세요"),
  }[status];
  const live = ready && !failed && !editing && !suspended;
  const selectedAction = () => {
    if (!selected) return;
    if (selected.kind === "frame" || selected.kind === "board") callbacks.current.open(selected.id);
    else scene.current?.action();
  };
  const selectedLabel = !selected
    ? ""
    : selected.kind === "frame"
      ? own
        ? t("사진 넣기")
        : t("사진 보기")
      : selected.kind === "board"
        ? own
          ? t("방명록")
          : t("방명록 남기기")
        : ["sofa", "chair"].includes(selected.kind)
          ? status === "sitting"
            ? t("일어나기")
            : t("앉기")
          : t("살펴보기");

  return (
    <section className={editing ? "home3d editing" : "home3d"}>
      <div className="home3d-canvas" ref={host} />
      <header className="home3d-top">
        {/* While arranging furniture the edit bar takes the title's place
            (the title stays in the DOM, hidden, because it names the dialog). */}
        <div className="home3d-heading">{heading}</div>
        {editing ? (
          <div className="home3d-editbar" role="toolbar" aria-label={t("가구 배치")}>
            <span>
              <strong>{t("가구 배치")}</strong>
              <small role="status">{statusText}</small>
            </span>
            <button type="button" disabled={busy || suspended} onClick={stopEditing}>
              {dirty ? t("취소") : t("완료")}
            </button>
            <button
              type="button"
              className="home3d-primary"
              disabled={busy || suspended || !ready || failed || (!dirty && !!data.room3d)}
              onClick={() => void save()}
            >
              <Save size={16} />
              {busy ? t("저장 중…") : t("배치 저장")}
            </button>
          </div>
        ) : null}
        <div className="home3d-window">{windowActions}</div>
      </header>

      {live ? (
        <nav className="home3d-dock" aria-label={t("집에서 할 수 있는 일")}>
          {own ? (
            <button type="button" disabled={busy} onClick={startEditing}>
              <LayoutGrid size={20} />
              <span>{t("가구 배치")}</span>
            </button>
          ) : null}
          <button type="button" disabled={busy} onClick={() => visit("board")}>
            <MessageSquareText size={20} />
            <span>{t("방명록")}</span>
          </button>
          <button type="button" disabled={busy} onClick={() => visit("frame")}>
            <ImageIcon size={20} />
            <span>{t("사진")}</span>
          </button>
          {dock.map((action) => (
            <button type="button" key={action.key} disabled={action.disabled} onClick={action.onClick}>
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </nav>
      ) : null}

      {/* The hint steps aside while a piece of furniture card takes the bottom of the room. */}
      {live && !selected ? (
        <p className="home3d-status" role="status">
          <span className={status === "walking" ? "moving" : ""} aria-hidden="true" />
          {statusText}
        </p>
      ) : null}

      <div className="home3d-bottom">
        {selected && ready && !suspended ? (
          <div className="home3d-card" role="group" aria-label={names[selected.kind]}>
            <span>
              <small>{editing ? t("선택한 가구") : t("가까이에서")}</small>
              <strong>{names[selected.kind]}</strong>
            </span>
            {editing ? (
              <>
                <button type="button" className="home3d-round" disabled={busy} aria-label={t("회전")} onClick={() => scene.current?.rotate()}>
                  <RotateCw size={18} />
                </button>
                <button type="button" className="home3d-round" disabled={busy} aria-label={t("삭제")} onClick={() => scene.current?.remove()}>
                  <Trash2 size={18} />
                </button>
              </>
            ) : (
              <button type="button" className="home3d-primary" disabled={busy} onClick={selectedAction}>
                {selectedLabel}
              </button>
            )}
            <button type="button" className="home3d-round" aria-label={t("닫기")} onClick={() => scene.current?.select(null)}>
              <X size={18} />
            </button>
          </div>
        ) : null}
        {editing && !suspended ? (
          <div className="home3d-catalog" role="group" aria-label={t("가구 추가")}>
            {(Object.keys(names) as Kind[]).map((kind) => (
              <button
                type="button"
                key={kind}
                disabled={
                  busy ||
                  draft.length >= 16 ||
                  (kind === "frame" && draft.filter((item) => item.kind === "frame").length >= 3) ||
                  (kind === "board" && draft.some((item) => item.kind === "board"))
                }
                onClick={() => scene.current?.add(kind)}
              >
                <Plus size={14} />
                {names[kind]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {ready && !failed && !suspended ? (
        <div className="home3d-camera">
          <button type="button" aria-label={t("확대")} onClick={() => scene.current?.zoom(0.82)}>
            <Plus size={18} />
          </button>
          <button type="button" aria-label={t("축소")} onClick={() => scene.current?.zoom(1.2)}>
            <Minus size={18} />
          </button>
          <button type="button" aria-label={t("시점 초기화")} onClick={() => scene.current?.resetCamera()}>
            <Maximize size={17} />
          </button>
        </div>
      ) : null}

      {/* Keyboard route to every piece of furniture; it only shows up while focused. */}
      {ready && !failed && !suspended ? (
        <div className="home3d-keyboard" role="group" aria-label={t("가구 바로 선택")}>
          {draft.map((item) => (
            <button
              type="button"
              key={item.id}
              disabled={busy}
              onClick={() => (editing ? scene.current?.select(item.id) : scene.current?.go(item.id))}
            >
              {names[item.kind]}
            </button>
          ))}
        </div>
      ) : null}

      {notice ? (
        <p className="home3d-notice" role="alert">
          {notice}
        </p>
      ) : null}

      {!ready || failed ? (
        <div className="home3d-loading" role="status">
          {failed ? (
            <>
              <p>{t("3D 화면을 불러오지 못했어요. WebGL을 지원하는 브라우저에서 다시 시도해주세요.")}</p>
              <button
                type="button"
                className="home3d-primary"
                onClick={() => {
                  setBuildKey(savedKey);
                  setRetry((value) => value + 1);
                }}
              >
                {t("다시 시도")}
              </button>
            </>
          ) : (
            <>
              <span className="home3d-spinner" aria-hidden="true" />
              <p>{t("방에 햇살을 들이는 중…")}</p>
              {/* The character download is most of the wait; the bar stays out of the live region's way. */}
              {progress > 0 ? (
                <span className="home3d-progress" aria-hidden="true">
                  <span style={{ transform: `scaleX(${progress})` }} />
                </span>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {discard ? (
        <div className="home-confirm" role="alertdialog" aria-label={t("저장하지 않은 방 변경 내용을 버릴까요?")}>
          <p>{t("저장하지 않은 방 변경 내용을 버릴까요?")}</p>
          <button type="button" disabled={busy} onClick={() => setDiscard(false)}>
            {t("계속 편집")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDiscard(false);
              setBuildKey(JSON.stringify(baseline));
              setRetry((value) => value + 1);
            }}
          >
            {t("변경 내용 버리기")}
          </button>
        </div>
      ) : null}

      {children}
    </section>
  );
}
