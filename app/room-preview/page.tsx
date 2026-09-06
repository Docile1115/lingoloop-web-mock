"use client";

import { useEffect, useRef, useState } from "react";
import {
  Armchair,
  ArrowLeft,
  Check,
  Hand,
  House,
  ImagePlus,
  LayoutGrid,
  LoaderCircle,
  Maximize,
  MessageSquare,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import { I18nProvider, t, useLocale } from "../lib/i18n";
import type { RoomScene3D } from "../lib/room3d/scene";
import type { Furnishing, Kind } from "../lib/room3d/models";
import "./preview.css";

const names = () => ({
  sofa: t("소파"),
  table: t("테이블"),
  desk: t("책상"),
  chair: t("의자"),
  shelf: t("책장"),
  plant: t("화분"),
  frame: t("액자"),
  board: t("화이트보드"),
  bed: t("침대"),
});
type Status = "idle" | "walking" | "sitting" | "blocked" | "editing";

function Preview() {
  useLocale();
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<RoomScene3D | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false),
    [selected, setSelected] = useState<Furnishing | null>(null),
    [panel, setPanel] = useState<Furnishing | null>(null);
  const [status, setStatus] = useState<Status>("idle"),
    [layout, setLayout] = useState<Furnishing[]>([]);
  const [notes, setNotes] = useState<Record<string, string[]>>({}),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [photoError, setPhotoError] = useState(false);
  const labels = names();
  useEffect(() => {
    const node = dialog.current;
    if (panel && node) {
      node.showModal();
      return () => node.close();
    }
  }, [panel]);
  useEffect(() => {
    let cancelled = false;
    import("../lib/room3d/scene")
      .then(({ RoomScene3D }) => {
        if (cancelled || !host.current) return;
        setReady(false);
        setSelected(null);
        setPanel(null);
        setEditing(false);
        setNotes({});
        try {
          scene.current = new RoomScene3D(host.current, {
            ready: () => setReady(true),
            error: () => setError(true),
            select: setSelected,
            open: (item) => {
              setPanel(item);
              setPhotoError(false);
              setDraft("");
            },
            status: setStatus,
            layout: setLayout,
          });
        } catch {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [attempt]);

  async function upload(file: File | undefined) {
    if (!file || !panel || busy) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setPhotoError(true);
      return;
    }
    setBusy(true);
    setPhotoError(false);
    const id = panel.id,
      active = scene.current,
      url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.width * image.height > 40_000_000)
        throw new Error("Image too large");
      const canvas = document.createElement("canvas"),
        scale = Math.min(1, 960 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      await active?.photo(id, canvas.toDataURL("image/jpeg", 0.88));
      setPanel((current) => (current?.id === id ? null : current));
    } catch {
      setPhotoError(true);
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
    }
  }
  const statusText = {
    idle: t("바닥을 눌러 걸어보세요"),
    walking: t("걸어가는 중"),
    sitting: t("편안히 쉬는 중"),
    blocked: t("공간이 부족해요. 다른 위치를 골라주세요."),
    editing: t("가구를 끌어서 배치하세요"),
  }[status];

  return (
    <main className="r3-preview">
      <header className="r3-header">
        {/* Full document navigation also tears down the standalone WebGL preview. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="r3-back" href="/" aria-label={t("돌아가기")}>
          <ArrowLeft size={20} />
        </a>
        <div className="r3-brand">
          <span>
            TimoTalk <em>HOME</em>
          </span>
          <small>{t("3D 공간 미리보기")}</small>
        </div>
        <span className="r3-badge">DESIGN LAB · 01</span>
      </header>
      <section className="r3-stage" aria-label={t("3D 공간 미리보기")}>
        <div className="r3-canvas" ref={host} />
        <div className="r3-scene-title">
          <span>THE SLOW LIVING ROOM</span>
          <h1>{t("나만의 작은 일상")}</h1>
          <p>{t("햇살이 드는 방, 잠깐 쉬어가도 좋아요.")}</p>
        </div>
        <div className="r3-modes" aria-label={t("모드 선택")}>
          <button
            disabled={!ready || error}
            aria-pressed={!editing}
            onClick={() => {
              if (scene.current?.setEditing(false)) {
                setEditing(false);
                setPanel(null);
              }
            }}
          >
            <House size={16} />
            {t("생활 모드")}
          </button>
          <button
            disabled={!ready || error}
            aria-pressed={editing}
            onClick={() => {
              if (scene.current?.setEditing(true)) {
                setEditing(true);
                setPanel(null);
              }
            }}
          >
            <LayoutGrid size={16} />
            {t("가구 배치")}
          </button>
        </div>
        <div className="r3-camera">
          <button
            aria-label={t("확대")}
            onClick={() => scene.current?.zoom(0.85)}
          >
            <Plus size={19} />
          </button>
          <button
            aria-label={t("축소")}
            onClick={() => scene.current?.zoom(1.18)}
          >
            <Minus size={19} />
          </button>
          <button
            aria-label={t("시점 초기화")}
            onClick={() => scene.current?.resetCamera()}
          >
            <Maximize size={18} />
          </button>
        </div>
        <div className="r3-status" role="status">
          <span className={status === "walking" ? "moving" : ""} />
          {statusText}
        </div>
        {selected && !panel && (
          <aside className="r3-context">
            <div>
              <small>{editing ? t("선택한 가구") : t("가까이에서")}</small>
              <strong>{labels[selected.kind]}</strong>
            </div>
            {editing ? (
              <>
                <button
                  aria-label={t("회전")}
                  onClick={() => scene.current?.rotate()}
                >
                  <RotateCw size={18} />
                </button>
                <button
                  aria-label={t("삭제")}
                  onClick={() => scene.current?.remove()}
                >
                  <Trash2 size={18} />
                </button>
              </>
            ) : (
              <button
                className="r3-primary"
                onClick={() => scene.current?.action()}
              >
                {selected.kind === "frame"
                  ? t("사진 넣기")
                  : selected.kind === "board"
                    ? t("방명록 남기기")
                    : ["sofa", "chair"].includes(selected.kind)
                      ? status === "sitting"
                        ? t("일어나기")
                        : t("앉기")
                      : t("살펴보기")}
              </button>
            )}
            <button
              aria-label={t("닫기")}
              onClick={() => scene.current?.select(null)}
            >
              <X size={18} />
            </button>
          </aside>
        )}
        {(!ready || error) && (
          <div className="r3-loading">
            {error ? (
              <>
                <p>
                {t("3D 화면을 불러오지 못했어요. WebGL을 지원하는 브라우저에서 다시 시도해주세요.")}
                </p>
                <button
                  className="r3-primary"
                  onClick={() => {
                    setError(false);
                    setReady(false);
                    setAttempt((v) => v + 1);
                  }}
                >
                  <RotateCcw size={16} />
                  {t("다시 시도")}
                </button>
              </>
            ) : (
              <>
                <LoaderCircle className="r3-spin" />
                <p>{t("방에 햇살을 들이는 중…")}</p>
              </>
            )}
          </div>
        )}
      </section>
      <footer className="r3-toolbar">
        {editing ? (
          <div className="r3-catalog">
            {(Object.keys(labels) as Kind[]).map((kind) => (
              <button key={kind} onClick={() => scene.current?.add(kind)}>
                <Plus size={14} />
                {labels[kind]}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="r3-hint">
              <span>{t("바닥 클릭 · 이동")}</span>
              <span>{t("가구 클릭 · 상호작용")}</span>
              <small>
                {t("PC: 우클릭 드래그로 시점 회전 · 모바일: 한 손가락 드래그")}
              </small>
            </div>
            <button
              className="r3-secondary"
              disabled={!ready || status === "walking"}
              onClick={() =>
                status === "sitting"
                  ? scene.current?.stand()
                  : scene.current?.wave()
              }
            >
              {status === "sitting" ? (
                <Armchair size={17} />
              ) : (
                <Hand size={17} />
              )}{" "}
              {status === "sitting" ? t("일어나기") : t("인사하기")}
            </button>
          </>
        )}
      </footer>
      <div className="r3-preview-note">
        <span>{t("로컬 동작 검증용 · 캐릭터는 임시 모델입니다.")}</span>
        <span>
          {t("배치·사진·방명록은 서버에 저장되지 않으며 새로고침하면 초기화됩니다.")}
        </span>
      </div>
      <details className="r3-access">
        <summary>{t("가구 바로 선택")}</summary>
        <div>
          {layout.map((item) => (
            <button
              key={item.id}
              disabled={!ready}
              onClick={() =>
                editing
                  ? scene.current?.select(item.id)
                  : scene.current?.go(item.id)
              }
            >
              {labels[item.kind]}
            </button>
          ))}
        </div>
      </details>
      {panel && (
        <dialog
          ref={dialog}
          className="r3-modal-backdrop"
          aria-labelledby="r3-dialog-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) setPanel(null);
          }}
        >
          <section className="r3-modal">
            <div className="r3-modal-top">
              <span>
                {panel.kind === "frame" ? (
                  <ImagePlus size={23} />
                ) : (
                  <MessageSquare size={23} />
                )}
              </span>
              <button
                disabled={busy}
                aria-label={t("닫기")}
                onClick={() => setPanel(null)}
              >
                <X size={20} />
              </button>
            </div>
            <h2 id="r3-dialog-title">
              {panel.kind === "frame"
                ? t("좋아하는 순간을 걸어두세요")
                : t("작은 인사를 남겨주세요")}
            </h2>
            <p>{t("이 미리보기 안에서만 확인할 수 있어요.")}</p>
            {panel.kind === "frame" ? (
              <>
                <label className="r3-upload">
                  <ImagePlus size={28} />
                  <strong>{busy ? t("사진 적용 중…") : t("사진 선택")}</strong>
                  <span>JPG / PNG / WebP · 8 MB</span>
                  <input
                    aria-label={t("사진 선택")}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(event) => {
                      void upload(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                {photoError && (
                  <p role="alert">
                    {t("사진을 확인해주세요. JPG, PNG, WebP 파일을 8MB 이하로 올려주세요.")}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="r3-notes">
                  {(notes[panel.id] || []).map((note, i) => (
                    <p key={i}>{note}</p>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!draft.trim()) return;
                    const next = [
                      ...(notes[panel.id] || []),
                      draft.trim(),
                    ].slice(-20);
                    setNotes((prev) => ({ ...prev, [panel.id]: next }));
                    scene.current?.notes(panel.id, next);
                    setDraft("");
                  }}
                >
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={300}
                    aria-label={t("방명록 내용")}
                    placeholder={t("따뜻한 한마디를 남겨주세요.")}
                  />
                  <div className="r3-form-bottom">
                    <small>{draft.length} / 300</small>
                    <button className="r3-primary" disabled={!draft.trim()}>
                      <Check size={16} />
                      {t("남기기")}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </dialog>
      )}
    </main>
  );
}
export default function Page() {
  return (
    <I18nProvider>
      <Preview />
    </I18nProvider>
  );
}
