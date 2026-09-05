"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { Armchair, Check, Home, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { RoomCanvas } from './RoomCanvas';
import { t } from '../lib/i18n';
import { ROOM_LABELS, ROOM_PRESET_LABELS } from '../lib/room-labels';
import {
  ROOM_FLOORS, ROOM_WALLS, ROOM_ITEMS, ROOM_PRESETS, WALL_COLOURS, FLOOR_COLOURS,
  addRoomItem, cellFree, copyRoom, moveRoomItem, normalizeRoom, roomDataUri, roomItemDataUri,
  type RoomConfig, type RoomItemId,
} from '../lib/room';
import type { AvatarConfig } from '../lib/avatar';

type Props = { name: string; value?: RoomConfig | null; avatar?: AvatarConfig | null; onSave?: (room: RoomConfig) => Promise<void> };
export function ProfileRoom({ name, value, avatar, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  return <section className="profile-room">
    <header className="room-card-heading">
      <span><Home size={17} /><strong>{t("{name}님의 마이룸", { name })}</strong></span>
      {onSave ? <button className="secondary-button" type="button" onClick={() => setEditing(true)}><Armchair size={16} />{t("방 꾸미기")}</button> : null}
    </header>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="room-scene-image" src={roomDataUri(value, avatar)} alt={t("{name}님의 마이룸", { name })} />
    {!value && onSave ? <p className="room-starter-note">{t("기본 방이에요. 취향에 맞게 꾸며보세요.")}</p> : null}
    {editing && onSave ? <RoomEditor name={name} value={value} avatar={avatar} onSave={onSave} onClose={() => setEditing(false)} /> : null}
  </section>;
}

function RoomEditor({ value, avatar, onSave, onClose }: Props & { onSave: (room: RoomConfig) => Promise<void>; onClose: () => void }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [initial] = useState(() => normalizeRoom(value));
  const [draft, setDraft] = useState(() => normalizeRoom(value));
  const [selected, setSelected] = useState<RoomItemId | null>(null);
  const [tab, setTab] = useState<'furniture' | 'style'>('furniture');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [discarding, setDiscarding] = useState(false);
  const continueEditing = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (discarding) continueEditing.current?.focus(); }, [discarding]);
  const busyRef = useRef(false);
  const guard = useRef({ dirty: false, saving: false });
  const changed = JSON.stringify(initial) !== JSON.stringify(draft);
  const chosen = draft.items.find((item) => item.id === selected);
  useEffect(() => { guard.current = { dirty: changed, saving }; }, [changed, saving]);
  useEffect(() => {
    const element = dialog.current!;
    const originalOverflow = document.body.style.overflow;
    const returnFocus = document.activeElement as HTMLElement | null;
    const historyState = window.history.state;
    const originalUrl = window.location.href;
    element.showModal();
    document.body.style.overflow = 'hidden';
    const unload = (event: BeforeUnloadEvent) => {
      if (guard.current.dirty || guard.current.saving) { event.preventDefault(); event.returnValue = ''; }
    };
    const pop = (event: PopStateEvent) => {
      if (guard.current.saving || guard.current.dirty) {
        event.stopImmediatePropagation(); window.history.pushState(historyState, '', originalUrl);
        if (!guard.current.saving) setDiscarding(true);
      }
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('popstate', pop, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('popstate', pop, true);
      document.body.style.overflow = originalOverflow;
      element.close(); returnFocus?.focus();
    };
  }, []);
  const close = () => {
    if (busyRef.current) return;
    if (!changed) onClose(); else setDiscarding(true);
  };
  const change = (next: RoomConfig) => { if (busyRef.current) return; setDraft(next); setError(''); };
  const save = async () => {
    if (busyRef.current) return;
    busyRef.current = true; guard.current.saving = true; setSaving(true); setError('');
    try { await onSave(draft); guard.current.dirty = false; guard.current.saving = false; onClose(); }
    catch { setError(t("방을 저장하지 못했어요. 다시 시도해 주세요.")); }
    finally { busyRef.current = false; guard.current.saving = false; setSaving(false); }
  };
  return <dialog ref={dialog} className="room-editor-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className="room-editor-heading">
      <div><span className="room-eyebrow">TIMO HOME</span><h2 id={titleId}>{t("나만의 작은 집")}</h2></div>
      <button type="button" className="room-icon-button" aria-label={t("닫기")} onClick={close} disabled={saving}><X size={22} /></button>
    </header>
    {discarding ? <section className="room-discard-prompt" role="alert" aria-label={t("저장하지 않은 방 변경 내용을 버릴까요?")}>
      <h3>{t("저장하지 않은 방 변경 내용을 버릴까요?")}</h3>
      <button ref={continueEditing} type="button" className="secondary-button" onClick={() => setDiscarding(false)}>{t("계속 편집")}</button>
      <button type="button" className="primary-button" onClick={onClose}>{t("변경 내용 버리기")}</button>
    </section> : <div className="room-editor-body">
      <div className="room-workspace">
        <RoomCanvas value={draft} avatar={avatar} selected={selected} disabled={saving} onSelect={setSelected} onChange={change} onBlocked={() => setError(t("여기에는 놓을 수 없어요"))}/>
        <p className="room-hint">{t("가구를 직접 끌어 옮겨보세요. 작은 소품은 아래 목록에서 선택할 수 있어요.")}</p>
        <div className="room-placement">
        {chosen ?
          <div className="room-placement-head"><strong>{t(ROOM_LABELS[chosen.id])}</strong><span>
            <button type="button" className="room-icon-button" aria-label={t("방향 바꾸기")} disabled={saving} onClick={() => change({ ...draft, items: draft.items.map((item) => item.id === chosen.id ? { ...item, flipped: !item.flipped } : item) })}><RotateCcw size={18} /></button>
            <button type="button" className="room-icon-button" aria-label={t("가구 치우기")} disabled={saving} onClick={() => { change({ ...draft, items: draft.items.filter((item) => item.id !== chosen.id) }); setSelected(null); }}><Trash2 size={18} /></button>
          </span></div> : <p className="room-hint">{t("가구를 선택해 주세요")}</p>}
        </div>
      </div>
      <div className="room-toolbox">
        {chosen ? <details className="room-precision"><summary>{t("정밀 배치")} · {t("{row}행 {column}열", {row:chosen.y+1, column:chosen.x+1})}</summary>
          <div className="room-position-grid" role="group" aria-label={t("가구 배치 위치")}>
            {Array.from({length:25}, (_, i) => {
              const x = i % 5; const y = Math.floor(i/5); const active = x === chosen.x && y === chosen.y;
              return <button type="button" key={i} aria-label={t("{row}행 {column}열", { row:y+1, column:x+1 })}
                aria-pressed={active} disabled={saving || !cellFree(draft,x,y,chosen.id)} className={active ? 'selected' : ''}
                onClick={() => change(moveRoomItem(draft,chosen.id,x,y))}>{active ? <Check size={16} /> : x===2 && y===3 ? <Home size={14} /> : <span aria-hidden="true">·</span>}</button>;
            })}
          </div>
        </details> : null}
        <div className="room-tool-tabs" role="group" aria-label={t("꾸밀 항목")}>
          <button type="button" aria-pressed={tab==='furniture'} onClick={() => setTab('furniture')}>{t("가구와 소품")}<small>{draft.items.length}/12</small></button>
          <button type="button" aria-pressed={tab==='style'} onClick={() => setTab('style')}>{t("방 분위기")}</button>
        </div>
        {tab==='furniture' ? <div className="room-catalogue">{ROOM_ITEMS.map((id) => {
          const placed = draft.items.some((item) => item.id === id);
          return <button type="button" key={id} className={selected===id ? 'selected' : ''} aria-pressed={selected===id} disabled={saving}
            onClick={() => { change(addRoomItem(draft,id)); setSelected(id); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={roomItemDataUri(id)} alt="" /><strong>{t(ROOM_LABELS[id])}</strong><small>{placed ? t("배치됨") : t("추가")}</small>
          </button>;
        })}</div> : <div className="room-style-tools">
          <h3>{t("벽지")}</h3><div className="room-swatches">{ROOM_WALLS.map((wall) => <button type="button" key={wall} aria-pressed={draft.wall===wall} disabled={saving} onClick={() => change({...draft,wall})}><i style={{background:WALL_COLOURS[wall]}} />{t(ROOM_LABELS[wall])}</button>)}</div>
          <h3>{t("바닥")}</h3><div className="room-swatches">{ROOM_FLOORS.map((floor) => <button type="button" key={floor} aria-pressed={draft.floor===floor} disabled={saving} onClick={() => change({...draft,floor})}><i style={{background:FLOOR_COLOURS[floor]}} />{t(ROOM_LABELS[floor])}</button>)}</div>
          <h3>{t("추천 인테리어")}</h3><p className="room-hint">{t("선택하면 현재 배치가 바뀌어요.")}</p>
          <div className="room-presets">{ROOM_PRESETS.map((preset,i) => <button type="button" key={i} disabled={saving} onClick={() => { change(copyRoom(preset)); setSelected(null); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={roomDataUri(preset,avatar)} alt="" /><strong>{t(ROOM_PRESET_LABELS[i])}</strong>
          </button>)}</div>
        </div>}
      </div>
    </div>}
    {!discarding ? <footer className="room-editor-footer">
      <div aria-live="polite">{error ? <p role="alert" className="room-error">{error}</p> : <small>{t("저장하면 내 프로필을 방문한 친구에게도 보여요.")}</small>}</div>
      <div><button className="secondary-button" type="button" disabled={saving} onClick={close}>{t("취소")}</button>
        <button className="primary-button" type="button" disabled={saving || (!changed && !!value)} onClick={() => void save()}><Save size={17}/>{saving ? t("저장 중…") : t("방 저장")}</button></div>
    </footer> : null}
  </dialog>;
}
