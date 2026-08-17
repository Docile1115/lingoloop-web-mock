"use client";

import { useEffect } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { BadgeCheck, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { avatarSize, type AvatarSize } from "../lib/tokens";
import { t } from "../lib/i18n";
import "./ui.css";

/** 최상위 래퍼. 이 안에서만 토큰이 적용됩니다. */
export function UIScope({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ui-scope ${className}`.trim()}>{children}</div>;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  block,
  icon: Icon,
  className = "",
  ...rest
}: {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "accent";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  icon?: LucideIcon;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = ["ui-button", `ui-button-${variant}`];
  if (size !== "md") classes.push(`ui-button-${size}`);
  if (block) classes.push("ui-button-block");
  if (className) classes.push(className);

  return (
    <button type="button" className={classes.join(" ")} {...rest}>
      {Icon ? <Icon size={size === "sm" ? 15 : 17} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  icon: Icon,
  muted,
  className = "",
  ...rest
}: {
  label: string;
  icon: LucideIcon;
  muted?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`ui-icon-button ${muted ? "ui-icon-button-muted" : ""} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon size={19} strokeWidth={2} />
    </button>
  );
}

export function Avatar({
  name,
  src,
  size = "md",
  online,
  badge: BadgeIcon,
}: {
  name: string;
  src?: string;
  size?: AvatarSize;
  online?: boolean;
  /** 우하단 원형 배지 — 팔로우 추천 등. */
  badge?: LucideIcon;
}) {
  const px = avatarSize[size];

  return (
    <span className="ui-avatar" role="img" aria-label={name} style={{ width: px, height: px }}>
      {src ? (
        <img className="ui-avatar-img" src={src} alt="" />
      ) : (
        <svg className="ui-avatar-fallback" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8.6" r="3.8" />
          <path d="M12 13.6c-4.2 0-7.6 2.7-7.6 6 0 .6.5 1.1 1.1 1.1h13c.6 0 1.1-.5 1.1-1.1 0-3.3-3.4-6-7.6-6Z" />
        </svg>
      )}
      {online ? <span className="ui-avatar-dot" /> : null}
      {BadgeIcon ? (
        <span className="ui-avatar-badge">
          <BadgeIcon size={9} strokeWidth={2.6} />
        </span>
      ) : null}
    </span>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "outline" | "accent" }) {
  return <span className={`ui-pill ${tone === "default" ? "" : `ui-pill-${tone}`}`.trim()}>{children}</span>;
}

export function Divider() {
  return <hr className="ui-divider" />;
}

/**
 * 게시물 한 줄. connected가 true면 아바타 아래로 세로 연결선을 그립니다.
 * 스레드의 마지막 항목만 connected를 빼면 선이 자연스럽게 끊깁니다.
 */
export function ThreadItem({
  avatar,
  connected,
  children,
}: {
  avatar: ReactNode;
  connected?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="ui-thread-row">
      <div className="ui-thread-gutter">
        {avatar}
        {connected ? <span className="ui-thread-line" /> : null}
      </div>
      <div className="ui-thread-body">{children}</div>
    </article>
  );
}

export function Action({
  label,
  icon: Icon,
  count,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`ui-action ${active ? "ui-action-on" : ""}`.trim()}
      aria-label={label}
      onClick={onClick}
    >
      <Icon size={18} strokeWidth={2} />
      {count ? <span>{count}</span> : null}
    </button>
  );
}

export function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ui-input ${className}`.trim()} {...rest} />;
}

/** 테두리 없이 본문처럼 보이는 작성 필드. 입력에 따라 높이가 늘어납니다. */
export function Composer({
  className = "",
  onInput,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={1}
      className={`ui-composer ${className}`.trim()}
      onInput={(event) => {
        const el = event.currentTarget;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
        onInput?.(event);
      }}
      {...rest}
    />
  );
}

export function Sheet({
  title,
  onClose,
  headAction,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  /** 헤더 우측 액션 — 레퍼런스 작성 모달의 "게시" 위치 */
  headAction?: ReactNode;
  /** 하단 액션 바 */
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ui-backdrop">
      {/* 바깥 클릭으로 닫기. button이라 키보드로도 접근됩니다. */}
      <button type="button" className="ui-backdrop-hit" aria-label={t("닫기")} onClick={onClose} />
      <div className="ui-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ui-sheet-head">
          <span className="ui-sheet-title">{title}</span>
          {headAction}
        </div>
        <div className="ui-sheet-body">{children}</div>
        {footer ? <div className="ui-sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Header({ title, left, right }: { title?: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="ui-header">
      {left ?? <span />}
      {title ? <span className="ui-sheet-title">{title}</span> : null}
      {right ?? <span />}
    </header>
  );
}

export function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: { id: string; label: string; icon: LucideIcon }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="ui-tabbar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`ui-tab ${tab.id === active ? "ui-tab-on" : ""}`.trim()}
          aria-label={tab.label}
          aria-current={tab.id === active}
          onClick={() => onSelect(tab.id)}
        >
          <tab.icon size={24} strokeWidth={tab.id === active ? 2.4 : 2} />
        </button>
      ))}
    </nav>
  );
}

/** 피드 게시물 한 줄. ThreadItem 위에 작성자·본문·액션을 얹은 조합입니다. */
export function PostRow({
  author,
  topic,
  time,
  body,
  avatar,
  connected,
  actions,
  menu,
}: {
  author: string;
  /** "이름 › 주제" 형태로 붙는 주제 태그. */
  topic?: string;
  time: string;
  body: ReactNode;
  avatar: ReactNode;
  connected?: boolean;
  actions?: ReactNode;
  menu?: ReactNode;
}) {
  return (
    <ThreadItem avatar={avatar} connected={connected}>
      <div className="ui-post-head">
        <span className="ui-post-author">{author}</span>
        {topic ? (
          <span className="ui-post-topic">
            <span className="ui-post-chevron">›</span>
            {topic}
          </span>
        ) : null}
        <span className="ui-post-time">{time}</span>
        <span className="ui-post-spacer" />
        {menu}
      </div>
      <p className="ui-post-text">{body}</p>
      {actions ? <div className="ui-actions">{actions}</div> : null}
    </ThreadItem>
  );
}

/** 앱 전역 알림. message가 null이면 렌더하지 않습니다. */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="ui-toast-layer" role="status" aria-live="polite">
      <div className="ui-toast">{message}</div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`ui-switch ${checked ? "ui-switch-on" : ""}`.trim()}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch-knob" />
    </button>
  );
}

export function SettingRow({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-setting-row">
      {Icon ? (
        <span className="ui-setting-icon">
          <Icon size={18} strokeWidth={2} />
        </span>
      ) : null}
      <span className="ui-setting-text">
        <span className="ui-setting-title">{title}</span>
        {description ? <p className="ui-setting-desc">{description}</p> : null}
      </span>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="ui-field">
      <span className="ui-field-label">{label}</span>
      {children}
      {hint ? <p className="ui-field-hint">{hint}</p> : null}
    </label>
  );
}

/** 선택 상태가 있는 칩 묶음. 표시 전용은 Pill을 쓰세요. */
export function ChipSelect({
  options,
  selected,
  onToggle,
  multiple = true,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  multiple?: boolean;
}) {
  return (
    <div className="ui-chips" role={multiple ? "group" : "radiogroup"}>
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={on}
            className={`ui-chip ${on ? "ui-chip-on" : ""}`.trim()}
            onClick={() => onToggle(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Badge({ count, dot }: { count?: number; dot?: boolean }) {
  if (dot) return <span className="ui-badge ui-badge-dot" aria-hidden="true" />;
  if (!count) return null;
  return <span className="ui-badge">{count > 99 ? "99+" : count}</span>;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      {Icon ? <Icon className="ui-empty-icon" size={32} strokeWidth={1.6} /> : null}
      <span className="ui-empty-title">{title}</span>
      {description ? <p className="ui-empty-desc">{description}</p> : null}
      {action}
    </div>
  );
}

/** 실측 radius 8px. 커뮤니티 이미지 첨부용. */
export function MediaCard({ src, alt = "" }: { src: string; alt?: string }) {
  return (
    <span className="ui-media">
      <img src={src} alt={alt} />
    </span>
  );
}

/** 실측 82×68, radius 16px, 0.5px 테두리. */
export function AttachCard({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="ui-attach" onClick={onClick}>
      <Icon size={20} strokeWidth={2} />
      {label}
    </button>
  );
}

export function MessageBubble({
  text,
  time,
  mine,
  tail,
}: {
  text: string;
  time?: string;
  mine?: boolean;
  /** 연속 메시지 그룹의 마지막. 바깥쪽 아래 모서리가 4px로 꺾입니다. */
  tail?: boolean;
}) {
  return (
    <div className={`ui-msg ${mine ? "ui-msg-mine" : ""} ${tail ? "ui-msg-tail" : ""}`.replace(/\s+/g, " ").trim()}>
      <span className="ui-bubble">{text}</span>
      {time ? <span className="ui-msg-time">{time}</span> : null}
    </div>
  );
}

export function TypingIndicator({ label }: { label?: string }) {
  const text = label ?? t("입력 중");
  return (
    <span className="ui-typing" role="status" aria-label={text}>
      <span />
      <span />
      <span />
    </span>
  );
}

/** 게시물 안에 중첩되는 인용 카드. 실측 radius 8px · 1px 테두리 · 배경 투명. */
export function QuotePost({ children }: { children: ReactNode }) {
  return (
    <div className="ui-quote">
      <div className="ui-quote-inner">{children}</div>
    </div>
  );
}

/** 우하단 플로팅 작성 버튼. 실측 82×68 · radius 16 · right/bottom 24. */
export function FAB({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="ui-fab" aria-label={label} title={label} onClick={onClick}>
      <Icon size={24} strokeWidth={2} />
    </button>
  );
}

export function Sidebar({ children }: { children: ReactNode }) {
  return <nav className="ui-sidebar">{children}</nav>;
}

/** 사이드바 항목 묶음. 그룹 사이에 24px이 들어갑니다. */
export function SidebarGroup({ children }: { children: ReactNode }) {
  return <div className="ui-sidebar-group">{children}</div>;
}

export function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`ui-sidebar-item ${active ? "ui-sidebar-item-on" : ""}`.trim()}
      aria-current={active}
      onClick={onClick}
    >
      <Icon size={18} strokeWidth={active ? 2.4 : 2} />
      {label}
    </button>
  );
}

export function SidebarSection({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="ui-sidebar-section">
      {title}
      {action}
    </div>
  );
}

/** 실측 40h · radius 22px · #f5f5f5 채움 · 테두리 없음. */
export function SearchField({
  icon: Icon,
  className = "",
  ...rest
}: { icon?: LucideIcon } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`ui-search ${className}`.trim()}>
      {Icon ? <Icon size={16} strokeWidth={2} /> : null}
      <input {...rest} />
    </div>
  );
}

/** DM 대화 목록 한 줄. 실측 아바타 50 · 구분선 없음. */
export function ConversationRow({
  name,
  preview,
  time,
  avatar,
  unread,
  onClick,
}: {
  name: string;
  preview: string;
  time?: string;
  avatar: ReactNode;
  unread?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`ui-conv ${unread ? "ui-conv-unread" : ""}`.trim()}
      onClick={onClick}
    >
      {avatar}
      <span className="ui-conv-text">
        <span className="ui-conv-name">{name}</span>
        <p className="ui-conv-preview">{preview}</p>
      </span>
      <span className="ui-conv-meta">
        {time ? <span className="ui-conv-time">{time}</span> : null}
        {unread ? <Badge count={unread} /> : null}
      </span>
    </button>
  );
}

/** 스레드 순번. 실측 — 배경 없는 인라인 텍스트, 숫자 600 / 슬래시 400. */
export function PageIndicator({ current, total }: { current: number; total: number }) {
  return (
    <span className="ui-page-indicator">
      <b>{current}</b>
      <span>/</span>
      <b>{total}</b>
    </span>
  );
}

/** 회색 배경 위에 놓이는 흰 피드 카드. */
export function FeedCard({ children }: { children: ReactNode }) {
  return <div className="ui-feed-card">{children}</div>;
}

/**
 * 알림 목록 한 줄.
 * 구분선이 아바타를 건너뛰고 텍스트 컬럼부터 시작합니다(들여쓴 구분선).
 */
export function ActivityRow({
  name,
  time,
  kind,
  body,
  avatar,
  actions,
}: {
  name: string;
  time: string;
  /** "추천 스레드" · "팔로우 추천" 같은 분류 라벨. */
  kind: string;
  body?: ReactNode;
  avatar: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="ui-activity">
      {avatar}
      <div className="ui-activity-body">
        <div className="ui-activity-head">
          <span className="ui-activity-name">{name}</span>
          <span className="ui-activity-time">{time}</span>
        </div>
        <p className="ui-activity-kind">{kind}</p>
        {body ? <p className="ui-activity-text">{body}</p> : null}
        {actions ? <div className="ui-actions">{actions}</div> : null}
      </div>
    </article>
  );
}

/** 겹쳐 놓은 작은 아바타 묶음 — "팔로워 71명" 앞의 그것. */
export function AvatarStack({ children }: { children: ReactNode }) {
  return <span className="ui-avatar-stack">{children}</span>;
}

export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return <BadgeCheck className="ui-verified" size={size} strokeWidth={2.4} aria-label={t("인증됨")} />;
}

export function ProfileHeader({
  name,
  handle,
  bio,
  avatar,
  followers,
  followerAvatars,
  links,
  action,
}: {
  name: string;
  handle: string;
  bio?: string;
  avatar: ReactNode;
  followers: string;
  followerAvatars?: ReactNode;
  links?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="ui-profile">
      <div className="ui-profile-top">
        <div className="ui-profile-id">
          <div className="ui-profile-name">{name}</div>
          <p className="ui-profile-handle">{handle}</p>
        </div>
        <span className="ui-profile-avatar">{avatar}</span>
      </div>
      {bio ? <p className="ui-profile-bio">{bio}</p> : null}
      <div className="ui-profile-meta">
        {followerAvatars ? <AvatarStack>{followerAvatars}</AvatarStack> : null}
        <span className="ui-profile-followers">{followers}</span>
        {links ? <span className="ui-profile-links">{links}</span> : null}
      </div>
      {action ? <div className="ui-profile-edit">{action}</div> : null}
    </header>
  );
}

/** 밑줄형 탭. 하단 아이콘 탭은 TabBar를 쓰세요. */
export function Tabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="ui-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          className={`ui-tab-item ${tab.id === active ? "ui-tab-item-on" : ""}`.trim()}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** 아바타 + placeholder + 게시 버튼으로 된 작성 유도 행. */
export function ComposerTrigger({
  avatar,
  placeholder,
  action,
  onClick,
}: {
  avatar: ReactNode;
  placeholder: string;
  action?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="ui-composer-trigger">
      {avatar}
      <button type="button" className="ui-composer-trigger-text" onClick={onClick}>
        {placeholder}
      </button>
      {action}
    </div>
  );
}

/** 본문 아래 링크 카드 — 도메인 두 줄 구성. */
export function LinkPreview({
  domain,
  title,
  onClick,
}: {
  domain: string;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="ui-link-preview" onClick={onClick}>
      <span className="ui-link-domain">
        <Globe size={12} strokeWidth={2} />
        {domain}
      </span>
      <span className="ui-link-title">{title ?? domain}</span>
    </button>
  );
}

/* ── 메시지 화면 ── */

export function SplitLayout({ children }: { children: ReactNode }) {
  return <div className="ui-split">{children}</div>;
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="ui-panel">
      <div className="ui-panel-head">
        <span className="ui-panel-title">{title}</span>
        {action}
      </div>
      <div className="ui-panel-body">{children}</div>
    </section>
  );
}

export function FilterChips({
  options,
  active,
  onSelect,
}: {
  options: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="ui-filters" role="tablist">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={option.id === active}
          className={`ui-filter ${option.id === active ? "ui-filter-on" : ""}`.trim()}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ChatHeader({
  name,
  subtitle,
  avatar,
  verified,
  action,
}: {
  name: string;
  subtitle?: string;
  avatar: ReactNode;
  verified?: boolean;
  action?: ReactNode;
}) {
  return (
    <header className="ui-chat-head">
      {avatar}
      <span className="ui-chat-head-text">
        <span className="ui-chat-head-name">
          {name}
          {verified ? <VerifiedBadge /> : null}
        </span>
        {subtitle ? <span className="ui-chat-head-sub">{subtitle}</span> : null}
      </span>
      {action}
    </header>
  );
}

export function ChatEmptyState({
  logo,
  title,
  description,
}: {
  logo?: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="ui-chat-empty">
      {logo}
      <span className="ui-chat-empty-title">{title}</span>
      <p className="ui-chat-empty-desc">{description}</p>
    </div>
  );
}
