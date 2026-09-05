"use client";

import { useRef, useState, type PointerEvent } from 'react';
import { Move } from 'lucide-react';
import { t } from '../lib/i18n';
import { ROOM_LABELS } from '../lib/room-labels';
import { canPlaceRoomItem, moveRoomItem, renderRoomSvg, roomCell, roomPoint, type RoomConfig, type RoomItemId } from '../lib/room';
import type { AvatarConfig } from '../lib/avatar';

type Props = { value: RoomConfig; avatar?: AvatarConfig | null; selected: RoomItemId | null; disabled: boolean; onSelect: (id: RoomItemId) => void; onChange: (value: RoomConfig) => void; onBlocked: () => void };
type Gesture = { pointerId: number; id: RoomItemId; startX: number; startY: number; originX: number; originY: number; width: number; moved: boolean; x: number; y: number };

export function RoomCanvas({ value, avatar, selected, disabled, onSelect, onChange, onBlocked }: Props) {
  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<{ id: RoomItemId; x: number; y: number } | null>(null);
  const valid = preview ? canPlaceRoomItem(value, preview.id, preview.x, preview.y) : true;
  const shown = preview && valid ? moveRoomItem(value, preview.id, preview.x, preview.y) : value;
  const chosen = shown.items.find(item => item.id === selected);
  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !event.isPrimary || event.button !== 0 || gesture.current) return;
    const target = event.target as Element;
    const id = target.closest('[data-room-item]')?.getAttribute('data-room-item') as RoomItemId | null;
    const item = value.items.find(entry => entry.id === id);
    if (!item) return;
    event.preventDefault();
    onSelect(item.id);
    const bounds = event.currentTarget.getBoundingClientRect();
    gesture.current = { pointerId: event.pointerId, id: item.id, startX: event.clientX, startY: event.clientY, originX: item.x, originY: item.y, width: bounds.width, moved: false, x: item.x, y: item.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const update = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.startX; const dy = event.clientY - active.startY;
    if (!active.moved && Math.hypot(dx, dy) < 5) return;
    active.moved = true;
    const origin = roomPoint(active.originX, active.originY);
    const cell = roomCell(origin.x + dx * 600 / active.width, origin.y + dy * 600 / active.width);
    active.x = cell.x; active.y = cell.y;
    setPreview({ id: active.id, ...cell });
  };
  const end = (event: PointerEvent<HTMLDivElement>, cancel = false) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!cancel) update(event);
    gesture.current = null; setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancel || disabled || !active.moved) return;
    if (canPlaceRoomItem(value, active.id, active.x, active.y)) onChange(moveRoomItem(value, active.id, active.x, active.y));
    else onBlocked();
  };
  const p = chosen ? roomPoint(chosen.x, chosen.y) : null;
  return <div className={`room-live-scene room-interactive-scene${preview ? ' dragging' : ''}`} role="group" aria-label={t("가구 배치 위치")}
    onPointerDown={start} onPointerMove={update} onPointerUp={event => end(event)} onPointerCancel={event => end(event, true)} onLostPointerCapture={event => end(event, true)}>
    {/* Only the deterministic, validated local catalogue renderer supplies markup. No user SVG/HTML is accepted. */}
    <div className="room-svg-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: renderRoomSvg(shown, avatar, selected) }} />
    {p && chosen ? <button type="button" className="room-drag-handle" data-room-item={chosen.id} disabled={disabled}
      aria-label={t("{item} 이동", { item: t(ROOM_LABELS[chosen.id]) })} style={{ left: `${p.x / 6}%`, top: `${(p.y - 15) / 4.6}%` }}
      onKeyDown={event => {
        const directions: Record<string, [number, number]> = { ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0] };
        const delta = directions[event.key]; if (!delta || disabled) return;
        event.preventDefault(); const x = chosen.x + delta[0]; const y = chosen.y + delta[1];
        if (canPlaceRoomItem(value, chosen.id, x, y)) onChange(moveRoomItem(value, chosen.id, x, y)); else onBlocked();
      }}><Move size={18}/></button> : null}
    {preview && !valid ? <div className="room-drop-warning" role="status">{t("여기에는 놓을 수 없어요")}</div> : null}
  </div>;
}
