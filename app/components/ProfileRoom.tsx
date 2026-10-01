"use client";

import { Home } from 'lucide-react';
import { t } from '../lib/i18n';

/**
 * 프로필의 마이룸 카드. 꾸미기·방명록·사진은 모두 집 화면(HomeDialog)에서 합니다.
 *
 * 예전에는 "방 꾸미기" 와 "내 집 방문·방명록" 두 버튼이 같은 집 화면을 열었고,
 * 따로 있던 2D 방 편집 창은 어디서도 열리지 않았습니다. 버튼 하나로 합쳤습니다.
 */
type Props = { name: string; own?: boolean; onVisit: () => void };
export function ProfileRoom({ name, own, onVisit }: Props) {
  return <section className="profile-room">
    <header className="room-card-heading">
      <span><Home size={17} /><strong>{t("{name}님의 마이룸", { name })}</strong></span>
    </header>
    <button type="button" className="home-visit-button" onClick={onVisit}><Home size={18}/>{own?t("내 집 방문·방명록"):t("집 놀러 가기")}</button>
  </section>;
}
