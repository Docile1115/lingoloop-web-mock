"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  BookOpenCheck,
  Bookmark,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Crown,
  Ellipsis,
  Eye,
  Flame,
  Flag,
  Gift,
  Globe2,
  GraduationCap,
  Headphones,
  Heart,
  Image as ImageIcon,
  Languages,
  LockKeyhole,
  MessageCircle,
  Mic,
  Monitor,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Phone,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Star,
  Timer,
  Trophy,
  UserPlus,
  Users,
  UsersRound,
  Video,
  Volume2,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  currentUser,
  initialConversations,
  initialPosts,
  partners,
  rooms,
  savedPhrases,
  type Accent,
  type Conversation,
  type FeedPost,
  type Partner,
  type PracticeRoom,
} from "@/app/lib/demo-data";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type Section = "discover" | "community" | "chats" | "practice" | "learn";
type ApiState = "checking" | "ready" | "fallback";

type ModalState =
  | { type: "profile"; partner: Partner }
  | { type: "filters" }
  | { type: "compose" }
  | { type: "search" }
  | { type: "notifications" }
  | { type: "premium" }
  | { type: "room"; room: PracticeRoom }
  | { type: "exchange" }
  | { type: "report"; target: string }
  | { type: "onboarding" }
  | null;

const navItems: Array<{
  id: Section;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
}> = [
  { id: "discover", label: "파트너", shortLabel: "파트너", icon: Compass, description: "나와 잘 맞는 언어 파트너를 찾아보세요" },
  { id: "community", label: "커뮤니티", shortLabel: "피드", icon: UsersRound, description: "오늘 배운 표현과 문화를 나눠보세요" },
  { id: "chats", label: "대화", shortLabel: "대화", icon: MessageCircle, description: "대화 속에서 바로 배우고 복습하세요" },
  { id: "practice", label: "연습 라운지", shortLabel: "연습", icon: Radio, description: "실시간 음성방과 라이브 수업에 참여하세요" },
  { id: "learn", label: "내 학습", shortLabel: "내 학습", icon: GraduationCap, description: "쌓인 표현과 학습 리듬을 확인하세요" },
];

const accentStyle = (accent: Accent): CSSProperties => ({
  "--avatar-accent": `var(--accent-${accent})`,
} as CSSProperties);

function Avatar({
  name,
  flag,
  accent = "violet",
  size = "md",
  online,
}: {
  name: string;
  flag?: string;
  accent?: Accent;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  online?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className={`avatar avatar-${size}`} style={accentStyle(accent)} aria-hidden="true">
      <span className="avatar-initials">{initials}</span>
      {flag ? <span className="avatar-flag">{flag}</span> : null}
      {online ? <span className="avatar-online" /> : null}
    </span>
  );
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  badge,
  className = "",
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  badge?: number | string;
  className?: string;
}) {
  return (
    <button className={`icon-button ${className}`} type="button" aria-label={label} title={label} onClick={onClick}>
      <Icon size={19} strokeWidth={2} />
      {badge ? <span className="icon-badge">{badge}</span> : null}
    </button>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="section-heading">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="heading-action">{action}</div> : null}
    </header>
  );
}

export default function LingoLoopApp() {
  const [section, setSection] = useState<Section>("discover");
  const [modal, setModal] = useState<ModalState>(null);
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedChatId, setSelectedChatId] = useState(initialConversations[0].id);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [feedTab, setFeedTab] = useState<"recommended" | "learning" | "following">("recommended");
  const [discoverTab, setDiscoverTab] = useState<"recommended" | "online" | "new">("recommended");
  const [translatedPosts, setTranslatedPosts] = useState<Set<string>>(new Set());
  const [openCorrections, setOpenCorrections] = useState<Set<string>>(new Set(["post-1"]));
  const [toast, setToast] = useState<string | null>(null);
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [roomHandRaised, setRoomHandRaised] = useState(false);
  const [roomMicOn, setRoomMicOn] = useState(false);
  const [exchangeLength, setExchangeLength] = useState(15);
  const [settings, setSettings] = useState({ dmRequests: true, hideLocation: true, correctionAlerts: true });
  const toastTimer = useRef<number | null>(null);

  const currentNav = navItems.find((item) => item.id === section) ?? navItems[0];
  const selectedConversation = conversations.find((item) => item.id === selectedChatId) ?? conversations[0];

  const onlinePartners = useMemo(() => partners.filter((partner) => partner.online), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/health"),
      fetch("/api/bootstrap"),
      fetch("/api/partners"),
      fetch("/api/posts"),
      fetch("/api/conversations"),
    ])
      .then((responses) => {
        if (!cancelled) setApiState(responses.every((response) => response.ok) ? "ready" : "fallback");
      })
      .catch(() => {
        if (!cancelled) setApiState("fallback");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  };

  const goToSection = (next: Section) => {
    setSection(next);
    if (next === "chats") setMobileThreadOpen(false);
  };

  const togglePost = (postId: string, key: "liked" | "saved") => {
    setPosts((items) =>
      items.map((post) => {
        if (post.id !== postId) return post;
        if (key === "liked") {
          const nextLiked = !post.liked;
          return { ...post, liked: nextLiked, likes: post.likes + (nextLiked ? 1 : -1) };
        }
        return { ...post, saved: !post.saved };
      }),
    );
    showToast(key === "liked" ? "응원을 보냈어요" : "복습 컬렉션에 저장했어요");
  };

  const toggleSetValue = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startChat = (partner: Partner) => {
    const existing = conversations.find((item) => item.partnerId === partner.id);
    if (existing) {
      setSelectedChatId(existing.id);
    } else {
      const next: Conversation = {
        id: `chat-${partner.id}`,
        partnerId: partner.id,
        name: partner.name,
        flag: partner.flag,
        accent: partner.accent,
        preview: "새로운 연습 제안을 보내보세요",
        time: "지금",
        unread: 0,
        online: partner.online,
        messages: [
          {
            id: `welcome-${partner.id}`,
            mine: false,
            system: true,
            text: `${partner.name}님과 언어 교환을 시작했어요. 친절하고 안전한 대화를 만들어주세요.`,
            time: "지금",
          },
        ],
      };
      setConversations((items) => [next, ...items]);
      setSelectedChatId(next.id);
    }
    setSection("chats");
    setMobileThreadOpen(true);
    setModal(null);
    showToast(`${partner.name}님과 대화를 열었어요`);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selectedConversation) return;

    const newMessage = { id: `local-${Date.now()}`, mine: true, text, time: "지금" };
    setConversations((items) =>
      items.map((conversation) =>
        conversation.id === selectedConversation.id
          ? { ...conversation, preview: text, time: "지금", messages: [...conversation.messages, newMessage] }
          : conversation,
      ),
    );
    setDraft("");

    try {
      const apiConversationId = {
        "chat-maya": "conversation-maya",
        "chat-lucas": "conversation-sofia",
        "chat-aiko": "conversation-ren",
        "chat-group": "conversation-sofia",
      }[selectedConversation.id] ?? "conversation-maya";
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: apiConversationId, text, type: "text" }),
      });
      if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
      showToast("메시지를 보냈어요 · mock API 동기화 완료");
    } catch {
      showToast("메시지를 기기에 저장했어요 · 오프라인 데모");
    }
  };

  const publishPost = (text: string) => {
    const post: FeedPost = {
      id: `post-${Date.now()}`,
      authorId: "me",
      author: currentUser.name,
      handle: currentUser.handle,
      flag: currentUser.flag,
      accent: currentUser.accent,
      time: "방금",
      language: "영어",
      level: currentUser.level,
      text,
      translation: "이 게시물은 데모 번역을 요청하면 한국어로 표시됩니다.",
      tags: ["#오늘의연습", "#영어"],
      likes: 0,
      comments: 0,
      corrections: 0,
    };
    setPosts((items) => [post, ...items]);
    setModal(null);
    setSection("community");
    showToast("커뮤니티에 게시했어요");
  };

  const reportTarget = async (target: string) => {
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType: "user",
          targetId: `demo-${target.toLowerCase().replace(/\s+/g, "-")}`,
          reason: "other",
          details: "UI 프로토타입에서 제출한 데모 신고입니다.",
        }),
      });
      if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
    } catch {
      showToast("신고를 기기에 임시 저장했어요 · 오프라인 데모");
      setModal(null);
      return;
    }
    setModal(null);
    showToast("신고가 접수되었어요 · 상대에게 알리지 않아요");
  };

  return (
    <div className={`app-root section-${section}`}>
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <aside className="desktop-sidebar" aria-label="주요 메뉴">
        <button className="brand" type="button" onClick={() => goToSection("discover")} aria-label="LingoLoop 홈">
          <span className="brand-mark"><Languages size={22} strokeWidth={2.4} /></span>
          <span className="brand-wordmark">Lingo<span>Loop</span></span>
        </button>

        <nav className="side-nav">
          <span className="nav-label">LEARN TOGETHER</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={section === item.id ? "active" : ""}
                onClick={() => goToSection(item.id)}
                aria-current={section === item.id ? "page" : undefined}
              >
                <Icon size={20} />
                <span>{item.label}</span>
                {item.id === "chats" ? <span className="nav-count">7</span> : null}
              </button>
            );
          })}
        </nav>

        <button className="new-post-button" type="button" onClick={() => setModal({ type: "compose" })}>
          <PenLine size={18} /> 새 게시물
        </button>

        <div className="sidebar-spacer" />
        <button className="sidebar-upgrade" type="button" onClick={() => setModal({ type: "premium" })}>
          <span className="upgrade-icon"><Sparkles size={18} /></span>
          <span><strong>Loop Plus</strong><small>무제한 번역 · 고급 필터</small></span>
          <ChevronRight size={16} />
        </button>
        <button className="sidebar-profile" type="button" onClick={() => goToSection("learn")}>
          <Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="sm" online />
          <span><strong>{currentUser.name}</strong><small>{currentUser.native} → {currentUser.learning}</small></span>
          <MoreHorizontal size={18} />
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="mobile-brand" type="button" onClick={() => goToSection("discover")} aria-label="LingoLoop 홈">
            <span className="brand-mark"><Languages size={20} /></span>
            <span className="brand-wordmark">Lingo<span>Loop</span></span>
          </button>
          <div className="desktop-page-title">
            <strong>{currentNav.label}</strong>
            <span>{currentNav.description}</span>
          </div>
          <div className="topbar-actions">
            <span className={`api-indicator api-${apiState}`} title="mock API 상태">
              <span />{apiState === "ready" ? "Mock API 연결됨" : apiState === "checking" ? "연결 확인 중" : "오프라인 데모"}
            </span>
            <IconButton label="통합 검색" icon={Search} onClick={() => setModal({ type: "search" })} />
            <IconButton label="알림 3개" icon={Bell} badge={3} onClick={() => setModal({ type: "notifications" })} />
            <button className="top-profile" type="button" onClick={() => goToSection("learn")} aria-label="내 학습 프로필">
              <Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="xs" />
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <div className="workspace-grid">
          <main id="main-content" className="main-content">
            {section === "discover" ? (
              <DiscoverView
                tab={discoverTab}
                setTab={setDiscoverTab}
                onProfile={(partner) => setModal({ type: "profile", partner })}
                onChat={startChat}
                onFilters={() => setModal({ type: "filters" })}
                onSearch={() => setModal({ type: "search" })}
                onToast={showToast}
              />
            ) : null}
            {section === "community" ? (
              <CommunityView
                posts={posts}
                tab={feedTab}
                setTab={setFeedTab}
                translated={translatedPosts}
                corrections={openCorrections}
                onTranslate={(id) => toggleSetValue(setTranslatedPosts, id)}
                onCorrection={(id) => toggleSetValue(setOpenCorrections, id)}
                onToggle={togglePost}
                onCompose={() => setModal({ type: "compose" })}
                onProfile={(id) => {
                  const partner = partners.find((item) => item.id === id);
                  if (partner) setModal({ type: "profile", partner });
                }}
                onReport={(target) => setModal({ type: "report", target })}
                onToast={showToast}
              />
            ) : null}
            {section === "chats" ? (
              <ChatsView
                conversations={conversations}
                selected={selectedConversation}
                mobileThreadOpen={mobileThreadOpen}
                onSelect={(id) => {
                  setSelectedChatId(id);
                  setMobileThreadOpen(true);
                }}
                onBack={() => setMobileThreadOpen(false)}
                draft={draft}
                setDraft={setDraft}
                onSend={sendMessage}
                onExchange={() => setModal({ type: "exchange" })}
                onProfile={() => {
                  const partner = partners.find((item) => item.id === selectedConversation?.partnerId);
                  if (partner) setModal({ type: "profile", partner });
                  else showToast("그룹 정보 패널을 열었어요");
                }}
                onReport={() => setModal({ type: "report", target: selectedConversation?.name ?? "대화" })}
                onToast={showToast}
              />
            ) : null}
            {section === "practice" ? (
              <PracticeView
                onJoin={(room) => {
                  setRoomHandRaised(false);
                  setRoomMicOn(false);
                  setModal({ type: "room", room });
                }}
                onPremium={() => setModal({ type: "premium" })}
                onToast={showToast}
              />
            ) : null}
            {section === "learn" ? (
              <LearnView
                settings={settings}
                setSettings={setSettings}
                onOnboarding={() => setModal({ type: "onboarding" })}
                onPremium={() => setModal({ type: "premium" })}
                onToast={showToast}
              />
            ) : null}
          </main>

          <RightRail
            section={section}
            onlinePartners={onlinePartners}
            onProfile={(partner) => setModal({ type: "profile", partner })}
            onRoom={(room) => setModal({ type: "room", room })}
            onPremium={() => setModal({ type: "premium" })}
            onToast={showToast}
          />
        </div>
      </div>

      <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              className={section === item.id ? "active" : ""}
              onClick={() => goToSection(item.id)}
              aria-current={section === item.id ? "page" : undefined}
            >
              <span className="mobile-nav-icon"><Icon size={21} />{item.id === "chats" ? <i>7</i> : null}</span>
              <small>{item.shortLabel}</small>
            </button>
          );
        })}
      </nav>

      {modal ? (
        <ModalLayer
          modal={modal}
          onClose={() => setModal(null)}
          onStartChat={startChat}
          onPublish={publishPost}
          onReport={reportTarget}
          onToast={showToast}
          roomHandRaised={roomHandRaised}
          setRoomHandRaised={setRoomHandRaised}
          roomMicOn={roomMicOn}
          setRoomMicOn={setRoomMicOn}
          exchangeLength={exchangeLength}
          setExchangeLength={setExchangeLength}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          <CheckCircle2 size={18} /> {toast}
        </div>
      ) : null}
    </div>
  );
}

function DiscoverView({
  tab,
  setTab,
  onProfile,
  onChat,
  onFilters,
  onSearch,
  onToast,
}: {
  tab: "recommended" | "online" | "new";
  setTab: (value: "recommended" | "online" | "new") => void;
  onProfile: (partner: Partner) => void;
  onChat: (partner: Partner) => void;
  onFilters: () => void;
  onSearch: () => void;
  onToast: (message: string) => void;
}) {
  const visiblePartners = tab === "online" ? partners.filter((partner) => partner.online) : tab === "new" ? [...partners].reverse() : partners;

  return (
    <div className="view discover-view">
      <section className="discover-hero">
        <div className="hero-copy">
          <Pill tone="soft"><Sparkles size={13} /> 오늘의 매칭</Pill>
          <h1>배우는 만큼,<br /><em>가르치며 가까워져요.</em></h1>
          <p>언어 목표와 관심사, 활동 시간이 맞는 파트너를 찾았어요.</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={onSearch}><Search size={17} /> 파트너 검색</button>
            <button className="secondary-button" type="button" onClick={onFilters}><SlidersHorizontal size={17} /> 추천 조정</button>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="floating-avatar avatar-a"><Avatar name="Maya" flag="🇨🇦" accent="coral" size="lg" online /><span>Hello!</span></div>
          <div className="floating-avatar avatar-b"><Avatar name="Lucas" flag="🇪🇸" accent="amber" size="md" online /><span>¡Hola!</span></div>
          <div className="floating-avatar avatar-c"><Avatar name="Aiko" flag="🇯🇵" accent="rose" size="md" /><span>こんにちは</span></div>
          <div className="hero-center"><Languages size={27} /><strong>96%</strong><small>언어 교환 궁합</small></div>
        </div>
      </section>

      <section className="match-summary" aria-label="오늘의 매칭 요약">
        <div><span className="summary-icon violet"><UserPlus size={18} /></span><span><strong>18명</strong><small>새 추천 파트너</small></span></div>
        <div><span className="summary-icon coral"><MessageCircle size={18} /></span><span><strong>4개의 답장</strong><small>내 차례인 대화</small></span></div>
        <div><span className="summary-icon mint"><Timer size={18} /></span><span><strong>35분</strong><small>오늘의 연습</small></span></div>
        <button type="button" onClick={() => onToast("이번 주 학습 리포트를 열었어요")}>주간 리포트 <ChevronRight size={16} /></button>
      </section>

      <div className="content-toolbar">
        <div className="segmented-tabs" role="tablist" aria-label="파트너 필터">
          <button type="button" role="tab" aria-selected={tab === "recommended"} className={tab === "recommended" ? "active" : ""} onClick={() => setTab("recommended")}>나를 위한 추천</button>
          <button type="button" role="tab" aria-selected={tab === "online"} className={tab === "online" ? "active" : ""} onClick={() => setTab("online")}>지금 온라인</button>
          <button type="button" role="tab" aria-selected={tab === "new"} className={tab === "new" ? "active" : ""} onClick={() => setTab("new")}>새로 온 사람</button>
        </div>
        <button className="filter-button" type="button" onClick={onFilters}><SlidersHorizontal size={16} /><span>필터</span><i>3</i></button>
      </div>

      <section className="partner-grid" aria-label="추천 언어 파트너">
        {visiblePartners.slice(0, 4).map((partner, index) => (
          <article className="partner-card" key={partner.id}>
            <div className="partner-card-top">
              <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="lg" online={partner.online} />
              <div className="compatibility-ring" style={{ "--score": `${partner.compatibility * 3.6}deg` } as CSSProperties}>
                <span>{partner.compatibility}%</span>
              </div>
            </div>
            <div className="partner-name-row">
              <h2>{partner.name}</h2>{partner.verified ? <BadgeCheck size={16} className="verified" aria-label="인증됨" /> : null}
              <span>{partner.online ? "온라인" : "최근 활동"}</span>
            </div>
            <p className="partner-location">{partner.city}</p>
            <div className="language-exchange">
              <span><small>모국어</small><strong>{partner.native}</strong></span>
              <span className="language-arrows">⇄</span>
              <span><small>학습어 · {partner.level}</small><strong>{partner.learning}</strong></span>
            </div>
            <p className="partner-bio">{partner.bio}</p>
            <div className="interest-row">{partner.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
            <div className="partner-card-actions">
              <button className="card-secondary" type="button" onClick={() => onProfile(partner)}>프로필</button>
              <button className="card-primary" type="button" onClick={() => onChat(partner)}><MessageCircle size={16} /> 인사하기</button>
            </div>
            {index === 0 ? <span className="best-match"><Sparkles size={12} /> BEST MATCH</span> : null}
          </article>
        ))}
      </section>

      <button className="load-more" type="button" onClick={() => onToast("추천 파트너 8명을 더 불러왔어요")}>추천 더 보기 <ChevronDown size={17} /></button>
    </div>
  );
}

function CommunityView({
  posts,
  tab,
  setTab,
  translated,
  corrections,
  onTranslate,
  onCorrection,
  onToggle,
  onCompose,
  onProfile,
  onReport,
  onToast,
}: {
  posts: FeedPost[];
  tab: "recommended" | "learning" | "following";
  setTab: (value: "recommended" | "learning" | "following") => void;
  translated: Set<string>;
  corrections: Set<string>;
  onTranslate: (id: string) => void;
  onCorrection: (id: string) => void;
  onToggle: (id: string, key: "liked" | "saved") => void;
  onCompose: () => void;
  onProfile: (id: string) => void;
  onReport: (target: string) => void;
  onToast: (message: string) => void;
}) {
  return (
    <div className="view community-view">
      <SectionHeading
        eyebrow="GLOBAL NOTEBOOK"
        title="오늘은 어떤 말을 배웠나요?"
        description="완벽하지 않아도 괜찮아요. 서로의 문장을 다정하게 고쳐주는 공간이에요."
        action={<button className="primary-button" type="button" onClick={onCompose}><PenLine size={17} /> 새 글 쓰기</button>}
      />

      <button className="composer-card" type="button" onClick={onCompose}>
        <Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="sm" />
        <span>오늘 배운 표현이나 궁금한 문장을 공유해보세요…</span>
        <span className="composer-tools"><ImageIcon size={17} /><Mic size={17} /><CircleHelp size={17} /></span>
      </button>

      <div className="feed-layout">
        <div className="feed-column">
          <div className="content-toolbar feed-toolbar">
            <div className="segmented-tabs" role="tablist" aria-label="커뮤니티 피드">
              <button type="button" role="tab" aria-selected={tab === "recommended"} className={tab === "recommended" ? "active" : ""} onClick={() => setTab("recommended")}>추천</button>
              <button type="button" role="tab" aria-selected={tab === "learning"} className={tab === "learning" ? "active" : ""} onClick={() => setTab("learning")}>영어 학습</button>
              <button type="button" role="tab" aria-selected={tab === "following"} className={tab === "following" ? "active" : ""} onClick={() => setTab("following")}>팔로잉</button>
            </div>
            <button className="quiet-button" type="button" onClick={() => onToast("최신 게시물 순으로 정렬했어요")}><SlidersHorizontal size={16} /> 최신순</button>
          </div>

          {posts.map((post) => (
            <article className="feed-post" key={post.id}>
              <header className="post-header">
                <button className="post-author" type="button" onClick={() => onProfile(post.authorId)}>
                  <Avatar name={post.author} flag={post.flag} accent={post.accent} size="sm" online={post.authorId === "maya"} />
                  <span><strong>{post.author}{post.authorId === "maya" ? <BadgeCheck size={14} className="verified" /> : null}</strong><small>{post.handle} · {post.time}</small></span>
                </button>
                <div className="post-meta">
                  <Pill tone="language">{post.language} · {post.level}</Pill>
                  <button type="button" aria-label="게시물 메뉴" onClick={() => onReport(post.author)}><Ellipsis size={19} /></button>
                </div>
              </header>
              <p className="post-copy">{post.text}</p>
              {translated.has(post.id) ? <div className="translation-box"><Languages size={16} /><p><span>데모 번역</span>{post.translation}</p></div> : null}
              <div className="post-tags">{post.tags.map((tag) => <button type="button" key={tag} onClick={() => onToast(`${tag} 주제를 팔로우했어요`)}>{tag}</button>)}</div>
              {post.visual ? (
                <div className={`post-visual visual-${post.accent}`}>
                  <span className="visual-grid" />
                  <span className="visual-emoji">{post.visual.emoji}</span>
                  <span className="visual-copy"><small>{post.visual.eyebrow}</small><strong>{post.visual.title}</strong><em>{post.visual.caption}</em></span>
                </div>
              ) : null}
              {post.correction && corrections.has(post.id) ? (
                <div className="correction-card">
                  <header><span><WandSparkles size={16} /> 문장 교정</span><small>Jisoo 🇰🇷 · 2분 전</small></header>
                  <p className="before"><span>–</span>{post.correction.original}</p>
                  <p className="after"><span>+</span>{post.correction.fixed}</p>
                  <div className="correction-note"><BookOpenCheck size={15} /> {post.correction.note}</div>
                  <button type="button" onClick={() => onToast("교정 문장을 복습 카드에 저장했어요")}><Bookmark size={14} /> 복습에 저장</button>
                </div>
              ) : null}
              <footer className="post-actions">
                <button className={post.liked ? "active like" : ""} type="button" onClick={() => onToggle(post.id, "liked")}><Heart size={18} fill={post.liked ? "currentColor" : "none"} /> {post.likes}</button>
                <button type="button" onClick={() => onToast("댓글 패널을 열었어요")}><MessageCircle size={18} /> {post.comments}</button>
                <button className={corrections.has(post.id) ? "active correct" : ""} type="button" onClick={() => onCorrection(post.id)}><PenLine size={18} /> 교정 {post.corrections}</button>
                <button className={translated.has(post.id) ? "active" : ""} type="button" onClick={() => onTranslate(post.id)}><Languages size={18} /> 번역</button>
                <button className={post.saved ? "active save" : "post-save"} type="button" aria-label="저장" onClick={() => onToggle(post.id, "saved")}><Bookmark size={18} fill={post.saved ? "currentColor" : "none"} /></button>
              </footer>
            </article>
          ))}
        </div>

        <aside className="feed-side-card">
          <div className="side-card-header"><span className="summary-icon violet"><Flame size={18} /></span><span><strong>이번 주 함께 쓴 문장</strong><small>커뮤니티 학습 리포트</small></span></div>
          <strong className="big-number">142<span>개</span></strong>
          <div className="mini-progress"><span style={{ width: "72%" }} /></div>
          <p>지난주보다 <b>18개</b> 더 많은 문장이 교정되었어요.</p>
          <div className="top-helpers">
            <span><Avatar name="Jisoo" accent="mint" size="xs" /><b>Jisoo</b><small>교정 32</small></span>
            <span><Avatar name="Maya" accent="coral" size="xs" /><b>Maya</b><small>교정 27</small></span>
            <span><Avatar name="Ken" accent="blue" size="xs" /><b>Ken</b><small>교정 21</small></span>
          </div>
          <button type="button" onClick={() => onToast("이번 주 도움 기록을 열었어요")}>기여 리포트 보기 <ChevronRight size={15} /></button>
        </aside>
      </div>
    </div>
  );
}

function ChatsView({
  conversations,
  selected,
  mobileThreadOpen,
  onSelect,
  onBack,
  draft,
  setDraft,
  onSend,
  onExchange,
  onProfile,
  onReport,
  onToast,
}: {
  conversations: Conversation[];
  selected: Conversation;
  mobileThreadOpen: boolean;
  onSelect: (id: string) => void;
  onBack: () => void;
  draft: string;
  setDraft: (text: string) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  onExchange: () => void;
  onProfile: () => void;
  onReport: () => void;
  onToast: (message: string) => void;
}) {
  const [listTab, setListTab] = useState<"all" | "turn" | "requests">("all");
  const [translatedMessages, setTranslatedMessages] = useState<Set<string>>(new Set(["m1"]));
  const filtered = conversations.filter((item) => listTab === "turn" ? item.myTurn : listTab === "requests" ? item.id === "chat-aiko" : true);

  return (
    <div className={`chat-shell ${mobileThreadOpen ? "mobile-thread-open" : ""}`}>
      <section className="conversation-panel">
        <header className="conversation-title">
          <div><h1>대화</h1><Pill tone="soft">7 unread</Pill></div>
          <IconButton label="새 대화" icon={PenLine} onClick={() => onToast("파트너 검색에서 새 대화를 시작해보세요")} />
        </header>
        <label className="chat-search"><Search size={16} /><input type="search" placeholder="이름 또는 대화 검색" /></label>
        <div className="chat-list-tabs">
          <button type="button" className={listTab === "all" ? "active" : ""} onClick={() => setListTab("all")}>전체</button>
          <button type="button" className={listTab === "turn" ? "active" : ""} onClick={() => setListTab("turn")}>내 차례 <span>4</span></button>
          <button type="button" className={listTab === "requests" ? "active" : ""} onClick={() => setListTab("requests")}>요청함</button>
        </div>
        <div className="conversation-list">
          {filtered.map((conversation) => (
            <button
              type="button"
              className={`conversation-item ${selected.id === conversation.id ? "active" : ""}`}
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
            >
              <Avatar name={conversation.name} flag={conversation.flag} accent={conversation.accent} size="sm" online={conversation.online} />
              <span className="conversation-copy">
                <span className="conversation-name"><strong>{conversation.name}</strong><small>{conversation.time}</small></span>
                <span className={conversation.typing ? "typing" : ""}>{conversation.typing ? "입력 중…" : conversation.preview}</span>
                <span className="conversation-labels">
                  {conversation.myTurn ? <i>내 차례</i> : null}
                  {conversation.group ? <i className="group-label"><Users size={11} /> 그룹</i> : null}
                  {conversation.muted ? <i>알림 끔</i> : null}
                </span>
              </span>
              {conversation.unread ? <span className="unread-count">{conversation.unread}</span> : null}
            </button>
          ))}
        </div>
        <div className="safe-inbox"><ShieldCheck size={16} /><span><strong>안전한 메시지 요청함</strong><small>처음 온 메시지는 먼저 검토할 수 있어요.</small></span><ChevronRight size={16} /></div>
      </section>

      <section className="chat-thread" aria-label={`${selected.name}님과의 대화`}>
        <header className="thread-header">
          <button className="mobile-back" type="button" onClick={onBack} aria-label="대화 목록으로"><ArrowLeft size={21} /></button>
          <button className="thread-person" type="button" onClick={onProfile}>
            <Avatar name={selected.name} flag={selected.flag} accent={selected.accent} size="sm" online={selected.online} />
            <span><strong>{selected.name}</strong><small>{selected.online ? "온라인 · 영어 ⇄ 한국어" : "최근 활동 어제"}</small></span>
          </button>
          <div className="thread-actions">
            <button className="exchange-cta" type="button" onClick={onExchange}><Timer size={16} /><span>교환 세션</span></button>
            <IconButton label="음성 통화" icon={Phone} onClick={() => onToast("음성 통화 데모를 시작했어요")} />
            <IconButton label="영상 통화" icon={Video} onClick={() => onToast("영상 통화 데모를 시작했어요")} />
            <IconButton label="대화 메뉴" icon={Ellipsis} onClick={onReport} />
          </div>
        </header>

        <div className="exchange-banner">
          <span className="exchange-banner-icon"><Languages size={18} /></span>
          <span><strong>오늘의 교환 균형</strong><small>영어 8분 · 한국어 7분</small></span>
          <div className="balance-bar"><i style={{ width: "53%" }} /></div>
          <button type="button" onClick={onExchange}>15분 이어하기 <ChevronRight size={15} /></button>
        </div>

        <div className="message-area">
          <div className="day-divider"><span>오늘</span></div>
          {selected.messages.map((message) => {
            if (message.system) return <div className="system-message" key={message.id}><ShieldCheck size={14} />{message.text}</div>;
            if (message.correction) {
              return (
                <div className="message-row correction-message" key={message.id}>
                  <Avatar name={selected.name} accent={selected.accent} size="xs" />
                  <div className="chat-correction-card">
                    <span className="correction-label"><PenLine size={14} /> {selected.name}님이 문장을 고쳤어요</span>
                    <p className="before">{message.correction.original}</p>
                    <p className="after">{message.correction.fixed}</p>
                    <small>{message.correction.note}</small>
                    <button type="button" onClick={() => onToast("교정 문장을 복습 카드에 저장했어요")}><Bookmark size={14} /> 표현 저장</button>
                  </div>
                  <time>{message.time}</time>
                </div>
              );
            }
            return (
              <div className={`message-row ${message.mine ? "mine" : "theirs"}`} key={message.id}>
                {!message.mine ? <Avatar name={selected.name} accent={selected.accent} size="xs" /> : null}
                <div className="message-stack">
                  <div className="message-bubble">
                    {message.voice ? <button className="voice-message" type="button" onClick={() => onToast("음성 메시지를 재생 중이에요")}><span className="play-dot"><Play size={13} fill="currentColor" /></span><span className="waveform"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span><small>{message.voice}</small></button> : null}
                    {message.text ? <p>{message.text}</p> : null}
                  </div>
                  {message.translated && translatedMessages.has(message.id) ? <div className="message-translation"><Languages size={13} /> {message.translated}</div> : null}
                  <div className="message-tools">
                    {message.translated ? <button type="button" onClick={() => toggleLocalSet(setTranslatedMessages, message.id)}><Languages size={13} /> 번역</button> : null}
                    <button type="button" onClick={() => onToast("문장 교정 편집기를 열었어요")}><PenLine size={13} /> 교정</button>
                    <button type="button" onClick={() => onToast("표현을 저장했어요")}><Bookmark size={13} /> 저장</button>
                    <button type="button" onClick={() => onToast("문장을 원어민 발음으로 재생했어요")}><Volume2 size={13} /> 듣기</button>
                  </div>
                </div>
                <time>{message.time}{message.mine ? " · 읽음" : ""}</time>
              </div>
            );
          })}
          <div className="typing-indicator"><Avatar name={selected.name} accent={selected.accent} size="xs" /><span><i /><i /><i /></span><small>{selected.name}님이 입력 중</small></div>
        </div>

        <form className="message-composer" onSubmit={onSend}>
          <div className="writing-language"><span>EN</span> 영어로 작성 중 <ChevronDown size={13} /></div>
          <div className="composer-row">
            <IconButton label="파일 첨부" icon={Paperclip} onClick={() => onToast("파일 첨부 데모를 열었어요")} />
            <IconButton label="음성 메시지" icon={Mic} onClick={() => onToast("녹음 데모 · 다시 누르면 전송돼요")} />
            <label className="message-input">
              <span className="sr-only">메시지 입력</span>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`${selected.name}님에게 메시지 보내기`} rows={1} />
              <button type="button" aria-label="이모지" onClick={() => setDraft(`${draft} 😊`)}><Smile size={18} /></button>
            </label>
            <button className="send-button" type="submit" disabled={!draft.trim()} aria-label="메시지 보내기"><Send size={18} /></button>
          </div>
          <small className="composer-hint"><WandSparkles size={12} /> Enter로 줄바꿈 · 전송 전 문법 힌트는 데모로 제공돼요</small>
        </form>
      </section>
    </div>
  );
}

function toggleLocalSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function PracticeView({
  onJoin,
  onPremium,
  onToast,
}: {
  onJoin: (room: PracticeRoom) => void;
  onPremium: () => void;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<"rooms" | "live" | "classes">("rooms");

  return (
    <div className="view practice-view">
      <SectionHeading eyebrow="PRACTICE LOUNGE" title="듣다가, 준비되면 말해요." description="작은 음성방부터 라이브 수업까지 내 속도에 맞춰 참여하세요." action={<button className="secondary-button" type="button" onClick={() => onToast("방 만들기 설정을 열었어요")}><Plus size={17} /> 방 만들기</button>} />

      <div className="practice-tabs" role="tablist" aria-label="연습 콘텐츠">
        <button role="tab" type="button" aria-selected={tab === "rooms"} className={tab === "rooms" ? "active" : ""} onClick={() => setTab("rooms")}><Headphones size={18} /> 음성 라운지 <span>24</span></button>
        <button role="tab" type="button" aria-selected={tab === "live"} className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}><Radio size={18} /> 라이브</button>
        <button role="tab" type="button" aria-selected={tab === "classes"} className={tab === "classes" ? "active" : ""} onClick={() => setTab("classes")}><GraduationCap size={18} /> 클래스</button>
      </div>

      {tab === "rooms" ? (
        <>
          <article className="featured-room">
            <div className="featured-room-copy">
              <Pill tone="live"><span className="live-dot" /> LIVE · 42명 듣는 중</Pill>
              <h2>영어로 말하는<br />오늘의 <em>작은 성공</em></h2>
              <p>말하기 전에는 듣기만 해도 좋아요. 손을 들면 호스트가 차례를 안내해요.</p>
              <div className="featured-speakers">
                <span className="stacked-avatars"><Avatar name="Nina" accent="coral" size="sm" /><Avatar name="Joon" accent="mint" size="sm" /><Avatar name="Sofia" accent="amber" size="sm" /></span>
                <span><strong>Nina 외 3명</strong><small>영어 · A2–B2</small></span>
              </div>
              <button className="room-join-button" type="button" onClick={() => onJoin(rooms[0])}><Headphones size={17} /> 조용히 입장하기</button>
            </div>
            <div className="sound-stage" aria-hidden="true">
              <span className="sound-ring ring-a" /><span className="sound-ring ring-b" /><span className="sound-ring ring-c" />
              <div className="stage-host"><Avatar name="Nina" flag="🇦🇺" accent="coral" size="xl" online /><span><Mic size={14} /> speaking</span></div>
              <span className="sound-caption">“What is one small win<br />you had today?”</span>
            </div>
          </article>

          <div className="content-toolbar">
            <div><strong className="toolbar-title">지금 열려 있는 라운지</strong><Pill tone="soft">24 rooms</Pill></div>
            <button className="filter-button" type="button" onClick={() => onToast("언어와 레벨 필터를 열었어요")}><SlidersHorizontal size={16} /> 필터</button>
          </div>
          <div className="room-grid">
            {rooms.slice(1).map((room) => (
              <article className={`room-card room-${room.accent}`} key={room.id}>
                <div className="room-card-head"><span className="room-language"><Globe2 size={14} /> {room.language}</span>{room.scheduled ? <Pill tone="neutral"><CalendarDays size={12} /> 예정</Pill> : <span className="room-live"><i /> LIVE</span>}</div>
                <h3>{room.title}</h3>
                <p>{room.topic} · {room.level}</p>
                <div className="room-speakers">
                  <Avatar name={room.host} flag={room.hostFlag} accent={room.accent} size="sm" />
                  <span><strong>{room.host}</strong><small>{room.scheduled ?? `${room.listeners}명 참여 중`}</small></span>
                  <span className="mini-wave"><i /><i /><i /><i /><i /></span>
                </div>
                <button type="button" onClick={() => onJoin(room)}>{room.scheduled ? "알림 받기" : "입장하기"}<ChevronRight size={16} /></button>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {tab === "live" ? (
        <div className="catalog-grid">
          <CatalogCard accent="coral" icon="🎙️" label="LIVE NOW" title="뉴스로 배우는 오늘의 영어" meta="Emma 선생님 · 318명 시청" button="라이브 보기" onClick={() => onToast("라이브 플레이어 데모를 열었어요")} />
          <CatalogCard accent="blue" icon="🗺️" label="TODAY · 8 PM" title="여행에서 바로 쓰는 스페인어" meta="Diego · 초급" button="알림 받기" onClick={() => onToast("라이브 시작 알림을 설정했어요")} />
          <CatalogCard accent="mint" icon="☕" label="REPLAY" title="카페에서 자연스럽게 주문하기" meta="Yuki · 일본어 A1" button="다시 보기" onClick={() => onToast("다시보기 플레이어 데모를 열었어요")} />
        </div>
      ) : null}

      {tab === "classes" ? (
        <div className="class-layout">
          <article className="class-banner">
            <div><Pill tone="soft"><Crown size={13} /> LOOP CLASS</Pill><h2>대화에서 막혔던 순간을<br />다음 수업의 재료로.</h2><p>저장한 문장과 교정 기록으로 구성된 맞춤 미니 클래스예요.</p><button className="primary-button" type="button" onClick={onPremium}>7일 체험 시작</button></div>
            <span className="class-illustration"><BookOpenCheck size={50} /><i>12</i><small>review cards</small></span>
          </article>
          <div className="catalog-grid compact">
            <CatalogCard accent="violet" icon="💼" label="B1 · 6 LESSONS" title="면접에서 나를 설명하는 법" meta="진행률 2/6" button="이어보기" onClick={() => onToast("코스 플레이어 데모를 열었어요")} />
            <CatalogCard accent="amber" icon="🗣️" label="A2 · 8 LESSONS" title="발음이 가벼워지는 리듬 훈련" meta="새 코스" button="살펴보기" onClick={() => onToast("코스 소개를 열었어요")} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CatalogCard({ accent, icon, label, title, meta, button, onClick }: { accent: Accent; icon: string; label: string; title: string; meta: string; button: string; onClick: () => void }) {
  return <article className={`catalog-card catalog-${accent}`}><span className="catalog-art">{icon}</span><small>{label}</small><h3>{title}</h3><p>{meta}</p><button type="button" onClick={onClick}>{button}<ChevronRight size={16} /></button></article>;
}

function LearnView({
  settings,
  setSettings,
  onOnboarding,
  onPremium,
  onToast,
}: {
  settings: { dmRequests: boolean; hideLocation: boolean; correctionAlerts: boolean };
  setSettings: React.Dispatch<React.SetStateAction<{ dmRequests: boolean; hideLocation: boolean; correctionAlerts: boolean }>>;
  onOnboarding: () => void;
  onPremium: () => void;
  onToast: (message: string) => void;
}) {
  const toggle = (key: keyof typeof settings) => setSettings((current) => ({ ...current, [key]: !current[key] }));
  return (
    <div className="view learn-view">
      <SectionHeading eyebrow="MY LEARNING" title="꾸준함이 실력이 되는 중이에요." description="대화에서 배운 표현과 서로 도운 시간을 한눈에 확인하세요." action={<button className="secondary-button" type="button" onClick={onOnboarding}><RotateCcw size={16} /> 학습 목표 다시 설정</button>} />

      <section className="profile-dashboard">
        <div className="profile-summary-card">
          <Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="xl" online />
          <div className="profile-summary-copy"><span><h2>{currentUser.name}</h2><BadgeCheck size={17} className="verified" /></span><p>{currentUser.handle}</p><div className="profile-languages"><strong>한국어 <small>모국어</small></strong><span>⇄</span><strong>English <small>{currentUser.level}</small></strong></div></div>
          <button type="button" onClick={() => onToast("프로필 편집 폼을 열었어요")}><PenLine size={16} /> 프로필 편집</button>
        </div>
        <div className="learning-stats-grid">
          <article><span className="summary-icon coral"><Flame size={19} /></span><small>연속 학습</small><strong>{currentUser.streak}<em>일</em></strong><p>최고 기록 19일</p></article>
          <article><span className="summary-icon violet"><Trophy size={19} /></span><small>학습 포인트</small><strong>{currentUser.points.toLocaleString()}<em>XP</em></strong><p>이번 주 +240</p></article>
          <article><span className="summary-icon mint"><Timer size={19} /></span><small>상호 기여 균형</small><strong>92<em>%</em></strong><p>도움 4h 20m · 배움 4h 05m</p></article>
        </div>
      </section>

      <section className="weekly-card">
        <header><span><strong>이번 주 학습 리듬</strong><small>8월 5일 – 11일</small></span><Pill tone="success">목표의 86%</Pill></header>
        <div className="weekly-chart" aria-label="요일별 학습 시간 막대 그래프">
          {[34, 62, 48, 80, 57, 92, 70].map((value, index) => <div key={value + index}><span style={{ height: `${value}%` }}><i>{Math.round(value * 0.55)}m</i></span><small>{["월", "화", "수", "목", "금", "토", "일"][index]}</small></div>)}
        </div>
        <div className="weekly-insight"><Sparkles size={17} /><span><strong>목요일 저녁에 가장 집중이 잘 됐어요.</strong><small>다음 주에도 같은 시간에 20분 교환 세션을 잡아볼까요?</small></span><button type="button" onClick={() => onToast("다음 목요일 오후 8시에 학습 알림을 만들었어요")}>알림 만들기</button></div>
      </section>

      <div className="learn-columns">
        <section className="saved-phrases-card">
          <header><span><strong>오늘 복습할 표현</strong><small>{savedPhrases.length}개 · 약 4분</small></span><button type="button" onClick={() => onToast("전체 저장 표현을 열었어요")}>전체 보기 <ChevronRight size={15} /></button></header>
          <div className="phrase-list">
            {savedPhrases.map((item, index) => <article key={item.phrase}><button type="button" className="phrase-play" onClick={() => onToast("표현을 재생했어요")}><Volume2 size={16} /></button><span><strong>{item.phrase}</strong><small>{item.meaning}</small><em>{item.source}</em></span><span className={index === 0 ? "due-now" : ""}>{item.due}</span></article>)}
          </div>
          <button className="review-button" type="button" onClick={() => onToast("4분 복습 세션을 시작했어요")}><BookOpenCheck size={17} /> 4분 복습 시작</button>
        </section>

        <section className="settings-card">
          <header><span><strong>안전과 학습 설정</strong><small>언제든 바꿀 수 있어요</small></span><Settings size={18} /></header>
          <SettingRow icon={ShieldCheck} title="메시지 요청함" description="처음 온 메시지를 먼저 검토" checked={settings.dmRequests} onChange={() => toggle("dmRequests")} />
          <SettingRow icon={LockKeyhole} title="정밀 위치 숨기기" description="도시 수준만 프로필에 표시" checked={settings.hideLocation} onChange={() => toggle("hideLocation")} />
          <SettingRow icon={PenLine} title="교정 알림" description="내 문장이 교정되면 알려주기" checked={settings.correctionAlerts} onChange={() => toggle("correctionAlerts")} />
          <button className="blocked-link" type="button" onClick={() => onToast("차단 사용자 목록을 열었어요")}><Flag size={16} /> 신고 및 차단 관리 <ChevronRight size={15} /></button>
        </section>
      </div>

      <section className="upgrade-strip"><span className="upgrade-spark"><Crown size={22} /></span><span><strong>Loop Plus로 학습 흐름을 끊김 없이</strong><small>무제한 번역 · 실시간 자막 · 고급 파트너 필터 · 광고 없음</small></span><button type="button" onClick={onPremium}>혜택 보기</button></section>
    </div>
  );
}

function SettingRow({ icon: Icon, title, description, checked, onChange }: { icon: LucideIcon; title: string; description: string; checked: boolean; onChange: () => void }) {
  return <label className="setting-row"><span className="setting-icon"><Icon size={17} /></span><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={onChange} /><i className="toggle" aria-hidden="true" /></label>;
}

function RightRail({
  section,
  onlinePartners,
  onProfile,
  onRoom,
  onPremium,
  onToast,
}: {
  section: Section;
  onlinePartners: Partner[];
  onProfile: (partner: Partner) => void;
  onRoom: (room: PracticeRoom) => void;
  onPremium: () => void;
  onToast: (message: string) => void;
}) {
  return (
    <aside className="right-rail" aria-label="학습 컨텍스트">
      <section className="daily-goal-card">
        <header><span><small>TODAY</small><strong>오늘의 루프</strong></span><span className="goal-ring"><b>72</b>%</span></header>
        <div className="goal-list">
          <button type="button" className="done" onClick={() => onToast("파트너에게 답장하기 완료")}><span><Check size={13} /></span><p><strong>파트너에게 답장하기</strong><small>4개의 대화</small></p><b>+20</b></button>
          <button type="button" onClick={() => onToast("10분 말하기 타이머를 시작했어요")}><span><Mic size={13} /></span><p><strong>10분 말하기</strong><small>현재 7분</small></p><b>+40</b></button>
          <button type="button" onClick={() => onToast("복습 카드 6개를 열었어요")}><span><BookOpenCheck size={13} /></span><p><strong>표현 6개 복습</strong><small>오늘 마감</small></p><b>+30</b></button>
        </div>
        <div className="goal-streak"><Flame size={17} /><span><strong>12일 연속 학습 중</strong><small>내일도 5분이면 이어져요</small></span></div>
      </section>

      {section !== "practice" ? (
        <section className="rail-card online-card">
          <header><span><strong>지금 연습 가능한 사람</strong><small>{onlinePartners.length}명 온라인</small></span><button type="button" onClick={() => onToast("온라인 파트너 전체를 열었어요")}>전체</button></header>
          {onlinePartners.map((partner) => <button className="online-person" type="button" key={partner.id} onClick={() => onProfile(partner)}><Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="sm" online /><span><strong>{partner.name}</strong><small>{partner.native} ⇄ {partner.learning}</small></span><MessageCircle size={16} /></button>)}
        </section>
      ) : (
        <section className="rail-card upcoming-card">
          <header><span><strong>곧 시작해요</strong><small>내 관심 언어 기준</small></span><CalendarDays size={17} /></header>
          <button type="button" onClick={() => onRoom(rooms[3])}><span className="time-block"><b>21:00</b><small>오늘</small></span><span><strong>면접 영어 30초 소개</strong><small>Alex · B1–C1</small></span><ChevronRight size={15} /></button>
          <button type="button" onClick={() => onToast("내일 라이브 알림을 설정했어요")}><span className="time-block"><b>08:30</b><small>내일</small></span><span><strong>Slow morning English</strong><small>Emma · 모든 레벨</small></span><ChevronRight size={15} /></button>
        </section>
      )}

      <section className="rail-card phrase-card">
        <header><span><strong>오늘의 자연스러운 표현</strong><small>대화에서 바로 써보세요</small></span><button type="button" onClick={() => onToast("표현을 저장했어요")} aria-label="표현 저장"><Bookmark size={16} /></button></header>
        <blockquote>“That sounds like a plan.”</blockquote>
        <p>좋아요, 그렇게 하죠.</p>
        <div><button type="button" onClick={() => onToast("원어민 발음을 재생했어요")}><Volume2 size={15} /> 듣기</button><button type="button" onClick={() => onToast("연습 문장 입력창을 열었어요")}><PenLine size={15} /> 써보기</button></div>
      </section>

      <button className="rail-upgrade" type="button" onClick={onPremium}><span><Crown size={18} /></span><p><strong>Loop Plus</strong><small>번역 횟수 제한 없이</small></p><ChevronRight size={17} /></button>
    </aside>
  );
}

function ModalLayer({
  modal,
  onClose,
  onStartChat,
  onPublish,
  onReport,
  onToast,
  roomHandRaised,
  setRoomHandRaised,
  roomMicOn,
  setRoomMicOn,
  exchangeLength,
  setExchangeLength,
}: {
  modal: Exclude<ModalState, null>;
  onClose: () => void;
  onStartChat: (partner: Partner) => void;
  onPublish: (text: string) => void;
  onReport: (target: string) => void;
  onToast: (message: string) => void;
  roomHandRaised: boolean;
  setRoomHandRaised: (value: boolean) => void;
  roomMicOn: boolean;
  setRoomMicOn: (value: boolean) => void;
  exchangeLength: number;
  setExchangeLength: (value: number) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`modal modal-${modal.type}`} role="dialog" aria-modal="true" aria-label={modalLabel(modal.type)}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        {modal.type === "profile" ? <ProfileModal partner={modal.partner} onStartChat={onStartChat} onReport={() => onReport(modal.partner.name)} onToast={onToast} /> : null}
        {modal.type === "filters" ? <FiltersModal onClose={onClose} onToast={onToast} /> : null}
        {modal.type === "compose" ? <ComposeModal onPublish={onPublish} onToast={onToast} /> : null}
        {modal.type === "search" ? <SearchModal onStartChat={onStartChat} onToast={onToast} /> : null}
        {modal.type === "notifications" ? <NotificationsModal onToast={onToast} /> : null}
        {modal.type === "premium" ? <PremiumModal onClose={onClose} onToast={onToast} /> : null}
        {modal.type === "room" ? <RoomModal room={modal.room} handRaised={roomHandRaised} setHandRaised={setRoomHandRaised} micOn={roomMicOn} setMicOn={setRoomMicOn} onClose={onClose} onReport={() => onReport(modal.room.title)} onToast={onToast} /> : null}
        {modal.type === "exchange" ? <ExchangeModal length={exchangeLength} setLength={setExchangeLength} onClose={onClose} onToast={onToast} /> : null}
        {modal.type === "report" ? <ReportModal target={modal.target} onCancel={onClose} onConfirm={() => onReport(modal.target)} /> : null}
        {modal.type === "onboarding" ? <OnboardingModal onClose={onClose} onToast={onToast} /> : null}
      </div>
    </div>
  );
}

function modalLabel(type: Exclude<ModalState, null>["type"]) {
  const labels: Record<Exclude<ModalState, null>["type"], string> = { profile: "파트너 프로필", filters: "파트너 필터", compose: "새 게시물", search: "통합 검색", notifications: "알림", premium: "Loop Plus", room: "음성 라운지", exchange: "언어 교환 세션", report: "신고 및 차단", onboarding: "학습 목표 설정" };
  return labels[type];
}

function ProfileModal({ partner, onStartChat, onReport, onToast }: { partner: Partner; onStartChat: (partner: Partner) => void; onReport: () => void; onToast: (message: string) => void }) {
  return (
    <div className="profile-modal-content">
      <div className={`profile-cover cover-${partner.accent}`}><span className="cover-pattern" /></div>
      <div className="profile-modal-head">
        <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="xl" online={partner.online} />
        <div><span><h2>{partner.name}</h2>{partner.verified ? <BadgeCheck size={18} className="verified" /> : null}</span><p>{partner.handle} · {partner.city}</p></div>
        <div className="profile-head-actions"><IconButton label="프로필 신고" icon={Flag} onClick={onReport} /><button className="primary-button" type="button" onClick={() => onStartChat(partner)}><MessageCircle size={17} /> 대화 시작</button></div>
      </div>
      <div className="profile-match-strip"><span><Sparkles size={17} /><b>{partner.compatibility}%</b> 교환 궁합</span><span><Timer size={17} /><b>{partner.balance}</b></span><span><ShieldCheck size={17} />안전 프로필 확인됨</span></div>
      <div className="profile-modal-grid">
        <div className="profile-main">
          <section><h3>자기소개</h3><p>{partner.bio}</p></section>
          <section><h3>언어 교환</h3><div className="profile-language-grid"><span><small>가르칠 수 있어요</small><strong>{partner.flag} {partner.native}</strong><em>원어민</em></span><span><small>배우고 있어요</small><strong>🇰🇷 {partner.learning}</strong><em>{partner.level}</em></span></div></section>
          <section><h3>관심사</h3><div className="interest-row large">{partner.interests.map((item) => <span key={item}>{item}</span>)}</div></section>
        </div>
        <aside className="profile-details"><h3>잘 맞는 이유</h3><p><Clock3 size={16} /><span><strong>활동 시간</strong><small>{partner.activeTime}</small></span></p><p><Trophy size={16} /><span><strong>학습 목표</strong><small>{partner.goal}</small></span></p><p><PenLine size={16} /><span><strong>교정 스타일</strong><small>중요한 오류를 대화 후에</small></span></p><button type="button" onClick={() => onToast("파트너를 관심 목록에 저장했어요")}><Star size={16} /> 관심 파트너로 저장</button></aside>
      </div>
    </div>
  );
}

function FiltersModal({ onClose, onToast }: { onClose: () => void; onToast: (message: string) => void }) {
  const [onlineOnly, setOnlineOnly] = useState(true);
  const [level, setLevel] = useState("모든 레벨");
  return (
    <div className="form-modal">
      <header>
        <Pill tone="soft"><SlidersHorizontal size={13} /> SMART MATCH</Pill>
        <h2>어떤 파트너를 찾고 있나요?</h2>
        <p>모국어와 학습 목표가 서로 맞는 사람부터 추천해요.</p>
      </header>
      <div className="form-section">
        <span className="field-label">배우고 싶은 언어</span>
        <button className="select-control" type="button">🇺🇸 영어 <ChevronDown size={16} /></button>
      </div>
      <div className="form-section">
        <span className="field-label">파트너의 한국어 수준</span>
        <div className="choice-row">
          {["모든 레벨", "입문", "초급", "중급+"].map((item) => (
            <button type="button" className={level === item ? "active" : ""} key={item} onClick={() => setLevel(item)}>{item}</button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">공통 관심사</span>
        <div className="chip-options">
          {["영화", "여행", "음악", "기술", "요리", "독서"].map((item, index) => (
            <button type="button" className={index < 3 ? "active" : ""} key={item}>{index < 3 ? <Check size={13} /> : <Plus size={13} />}{item}</button>
          ))}
        </div>
      </div>
      <label className="setting-row standalone">
        <span className="setting-icon"><Eye size={17} /></span>
        <span><strong>현재 온라인인 사람만</strong><small>바로 답장할 가능성이 높아요</small></span>
        <input aria-label="현재 온라인인 사람만 보기" type="checkbox" checked={onlineOnly} onChange={() => setOnlineOnly(!onlineOnly)} />
        <i className="toggle" />
      </label>
      <div className="modal-footer">
        <button className="text-button" type="button" onClick={() => onToast("필터를 초기화했어요")}><RotateCcw size={15} /> 초기화</button>
        <button className="primary-button" type="button" onClick={() => { onClose(); onToast("조건에 맞는 파트너 18명을 찾았어요"); }}>18명 보기</button>
      </div>
    </div>
  );
}

function ComposeModal({ onPublish, onToast }: { onPublish: (text: string) => void; onToast: (message: string) => void }) {
  const [text, setText] = useState("");
  const [correction, setCorrection] = useState(true);
  return (
    <div className="compose-modal-content">
      <header><Pill tone="soft"><PenLine size={13} /> NEW NOTE</Pill><h2>커뮤니티에 공유하기</h2></header>
      <div className="compose-author">
        <Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="sm" />
        <span><strong>{currentUser.name}</strong><small>영어 학습자 · {currentUser.level}</small></span>
        <button type="button">전체 공개 <ChevronDown size={14} /></button>
      </div>
      <label className="compose-text">
        <span className="sr-only">게시물 내용</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="틀려도 괜찮아요. 오늘 배운 문장, 궁금한 표현, 문화 이야기를 나눠보세요…" rows={7} />
        <small>{text.length}/700</small>
      </label>
      <div className="compose-attachments">
        <button type="button" onClick={() => onToast("사진 첨부 데모를 열었어요")}><ImageIcon size={17} /> 사진</button>
        <button type="button" onClick={() => onToast("음성 녹음 데모를 열었어요")}><Mic size={17} /> 음성</button>
        <button type="button" onClick={() => onToast("주제를 선택했어요")}><Plus size={17} /> 주제</button>
      </div>
      <label className="correction-request">
        <span className="setting-icon"><WandSparkles size={17} /></span>
        <span><strong>원어민에게 교정 요청</strong><small>게시물에 교정 버튼이 표시돼요</small></span>
        <input aria-label="원어민에게 교정 요청" type="checkbox" checked={correction} onChange={() => setCorrection(!correction)} />
        <i className="toggle" />
      </label>
      <div className="modal-footer">
        <span className="safety-note"><ShieldCheck size={14} /> 연락처와 정밀 위치는 공유하지 마세요.</span>
        <button className="primary-button" type="button" disabled={!text.trim()} onClick={() => onPublish(text.trim())}>게시하기 <Send size={16} /></button>
      </div>
    </div>
  );
}

function SearchModal({ onStartChat, onToast }: { onStartChat: (partner: Partner) => void; onToast: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const results = partners.filter((partner) => `${partner.name} ${partner.native} ${partner.interests.join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0, 3);
  return <div className="search-modal-content"><header><Search size={21} /><input aria-label="통합 검색" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="사람, 언어, 주제, 저장한 표현 검색" /><kbd>ESC</kbd></header><div className="search-chips"><span>빠른 검색</span>{["영어 원어민", "지금 온라인", "#여행", "저장한 표현"].map((item) => <button type="button" key={item} onClick={() => setQuery(item.replace("#", ""))}>{item}</button>)}</div><section><h3>{query ? `“${query}” 검색 결과` : "추천 파트너"}</h3>{results.length ? results.map((partner) => <button className="search-result" type="button" key={partner.id} onClick={() => onStartChat(partner)}><Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="sm" online={partner.online} /><span><strong>{partner.name}</strong><small>{partner.native} ⇄ {partner.learning} · {partner.interests.join(" · ")}</small></span><Pill tone="success">{partner.compatibility}%</Pill><ChevronRight size={16} /></button>) : <div className="empty-search"><Search size={28} /><strong>검색 결과가 없어요</strong><p>언어나 관심사를 더 짧게 입력해보세요.</p></div>}</section><footer><span><Monitor size={14} /> 어디서든 <kbd>Ctrl</kbd> + <kbd>K</kbd></span><button type="button" onClick={() => onToast("전체 검색 결과 화면을 열었어요")}>전체 검색 보기</button></footer></div>;
}

function NotificationsModal({ onToast }: { onToast: (message: string) => void }) {
  const notifications = [
    { icon: PenLine, accent: "mint" as Accent, title: "Jisoo님이 문장을 교정했어요", body: "‘I was nervous…’를 더 자연스럽게 고쳐줬어요.", time: "2분 전" },
    { icon: MessageCircle, accent: "coral" as Accent, title: "Maya님의 답장이 도착했어요", body: "오늘 저녁에 15분 연습 어때요?", time: "8분 전" },
    { icon: Radio, accent: "violet" as Accent, title: "팔로우한 라운지가 곧 시작해요", body: "영어로 말하는 오늘의 작은 성공 · 오후 8시", time: "1시간 전" },
    { icon: Trophy, accent: "amber" as Accent, title: "12일 연속 학습을 달성했어요!", body: "이번 주에 240 XP를 모았어요.", time: "오늘" },
  ];
  return <div className="notifications-content"><header><div><Pill tone="soft"><Bell size={13} /> UPDATES</Pill><h2>알림</h2></div><button type="button" onClick={() => onToast("모든 알림을 읽음 처리했어요")}>모두 읽음</button></header><div className="notification-tabs"><button className="active" type="button">전체 <span>3</span></button><button type="button">대화</button><button type="button">학습</button></div><div className="notification-list">{notifications.map((item, index) => { const Icon = item.icon; return <button className={index < 3 ? "unread" : ""} type="button" key={item.title} onClick={() => onToast(`${item.title} 상세를 열었어요`)}><span className={`notification-icon accent-${item.accent}`}><Icon size={17} /></span><span><strong>{item.title}</strong><small>{item.body}</small><em>{item.time}</em></span>{index < 3 ? <i /> : null}</button>; })}</div><footer><button type="button" onClick={() => onToast("알림 설정을 열었어요")}><Settings size={15} /> 알림 설정</button></footer></div>;
}

function PremiumModal({ onClose, onToast }: { onClose: () => void; onToast: (message: string) => void }) {
  const features = [[Languages, "무제한 번역", "채팅·게시물·음성 전사까지"], [SlidersHorizontal, "고급 파트너 필터", "활동 시간·목표·교정 스타일"], [Radio, "실시간 자막", "음성 라운지와 통화에서"], [Bookmark, "무제한 복습 컬렉션", "배운 표현을 놓치지 않도록"]] as const;
  return <div className="premium-content"><div className="premium-hero"><span className="premium-orb"><Crown size={34} /></span><Pill tone="premium">LOOP PLUS</Pill><h2>대화의 흐름은 그대로,<br />배움은 더 선명하게.</h2><p>결제는 연결되지 않은 데모 화면입니다.</p></div><div className="premium-features">{features.map(([Icon, title, text]) => <div key={title}><span><Icon size={19} /></span><p><strong>{title}</strong><small>{text}</small></p><CheckCircle2 size={17} /></div>)}</div><div className="plan-options"><button type="button"><span><small>월간</small><strong>₩8,900 <em>/월</em></strong></span></button><button className="selected" type="button"><i>BEST</i><span><small>연간</small><strong>₩59,000 <em>/년</em></strong><b>월 ₩4,917</b></span><CheckCircle2 size={19} /></button></div><button className="premium-cta" type="button" onClick={() => { onClose(); onToast("7일 무료 체험 데모를 시작했어요 · 실제 결제 없음"); }}>7일 무료로 체험하기</button><small className="premium-legal">목업 전용 · 실제 구독 또는 결제가 발생하지 않습니다.</small></div>;
}

function RoomModal({ room, handRaised, setHandRaised, micOn, setMicOn, onClose, onReport, onToast }: { room: PracticeRoom; handRaised: boolean; setHandRaised: (value: boolean) => void; micOn: boolean; setMicOn: (value: boolean) => void; onClose: () => void; onReport: () => void; onToast: (message: string) => void }) {
  return <div className={`room-modal-content room-state-${room.accent}`}><header><div><Pill tone="live"><span className="live-dot" /> LIVE · {room.listeners || 1}명</Pill><h2>{room.title}</h2><p>{room.language} · {room.level} · 호스트 {room.hostFlag} {room.host}</p></div><IconButton label="방 신고" icon={Flag} onClick={onReport} /></header><div className="room-stage"><div className="stage-seat speaking"><Avatar name={room.host} flag={room.hostFlag} accent={room.accent} size="lg" online /><strong>{room.host}</strong><small>호스트 · 말하는 중</small><span><Mic size={13} /></span></div>{room.speakers.slice(1).map((speaker, index) => <div className="stage-seat" key={speaker}><Avatar name={speaker} accent={(["mint", "amber", "blue"] as Accent[])[index % 3]} size="md" /><strong>{speaker}</strong><small>{index === 0 ? "모더레이터" : "스피커"}</small><span><Mic size={13} /></span></div>)}<button className={`stage-seat empty ${handRaised ? "waiting" : ""}`} type="button" onClick={() => setHandRaised(!handRaised)}><span><Plus size={20} /></span><strong>{handRaised ? "승인 대기 중" : "빈 자리"}</strong><small>{handRaised ? "호스트가 확인하고 있어요" : "눌러서 발언 요청"}</small></button></div><div className="live-caption"><span><Volume2 size={15} /> 실시간 자막 · 데모</span><p>“What is one small win you had today?”</p><button type="button" onClick={() => onToast("선택한 문장을 번역했어요")}>문장 번역</button></div><div className="room-chat"><span><b>Nina</b> Welcome! Listening only is totally okay 👋</span><span><b>Joon</b> My small win was finishing a book!</span></div><footer><button className={micOn ? "mic-active" : ""} type="button" onClick={() => { setMicOn(!micOn); onToast(micOn ? "마이크를 껐어요" : "마이크를 켰어요 · 데모"); }} disabled={!handRaised}><Mic size={19} />{micOn ? "마이크 켜짐" : handRaised ? "마이크 켜기" : "먼저 손들기"}</button><button type="button" onClick={() => { setHandRaised(!handRaised); onToast(handRaised ? "발언 요청을 취소했어요" : "손을 들었어요. 호스트 승인을 기다려요"); }}><UserPlus size={19} />{handRaised ? "손 내리기" : "손들기"}</button><button type="button" onClick={() => onToast("선물 보내기 데모를 열었어요")}><Gift size={19} />응원</button><button className="leave-room" type="button" onClick={onClose}>나가기</button></footer></div>;
}

function ExchangeModal({ length, setLength, onClose, onToast }: { length: number; setLength: (value: number) => void; onClose: () => void; onToast: (message: string) => void }) {
  const half = length / 2;
  return (
    <div className="exchange-modal-content">
      <header>
        <span className="exchange-modal-icon"><Timer size={24} /></span>
        <Pill tone="soft">BALANCED SESSION</Pill>
        <h2>언어 교환 세션</h2>
        <p>한 언어씩 공평하게 연습하고, 끝나면 서로 짧은 피드백을 남겨요.</p>
      </header>
      <div className="exchange-partners">
        <span><Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="md" /><strong>{currentUser.name}</strong><small>영어 연습</small></span>
        <i><Languages size={18} /></i>
        <span><Avatar name="Maya" flag="🇨🇦" accent="coral" size="md" /><strong>Maya</strong><small>한국어 연습</small></span>
      </div>
      <section>
        <span className="field-label">세션 길이</span>
        <div className="duration-options">
          {[10, 15, 20, 30].map((value) => <button type="button" className={length === value ? "active" : ""} key={value} onClick={() => setLength(value)}><strong>{value}</strong><small>분</small></button>)}
        </div>
      </section>
      <div className="exchange-timeline"><span style={{ width: "50%" }}><b>EN</b><strong>{half}분</strong><small>서준의 영어</small></span><span><b>KO</b><strong>{half}분</strong><small>Maya의 한국어</small></span></div>
      <div className="exchange-features"><span><CheckCircle2 size={15} /> 턴 타이머</span><span><CheckCircle2 size={15} /> 실시간 메모</span><span><CheckCircle2 size={15} /> 종료 후 피드백</span></div>
      <div className="modal-footer">
        <button className="secondary-button" type="button" onClick={() => { onClose(); onToast("내일 오후 8시에 세션을 예약했어요"); }}><CalendarDays size={16} /> 예약하기</button>
        <button className="primary-button" type="button" onClick={() => { onClose(); onToast(`${length}분 교환 세션을 시작했어요 · 타이머 데모`); }}><Phone size={16} /> 지금 시작</button>
      </div>
    </div>
  );
}

function ReportModal({ target, onCancel, onConfirm }: { target: string; onCancel: () => void; onConfirm: () => void }) {
  const [reason, setReason] = useState("spam");
  return (
    <div className="report-content">
      <span className="report-icon"><ShieldCheck size={24} /></span>
      <h2>안전하게 이용할 수 있도록 도와주세요</h2>
      <p><b>{target}</b>을(를) 신고하거나 차단할 수 있어요. 신고 내용은 상대에게 알려지지 않습니다.</p>
      <div className="report-options">
        {[["spam", "스팸 또는 광고"], ["dating", "데이트·연애 목적"], ["harassment", "괴롭힘 또는 혐오 표현"], ["privacy", "개인정보 요구"], ["other", "기타"]].map(([id, label]) => (
          <label key={id}>
            <input aria-label={label} type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} />
            <span>{label}</span><CheckCircle2 size={17} />
          </label>
        ))}
      </div>
      <label className="block-option">
        <input aria-label="이 사용자도 함께 차단" type="checkbox" />
        <span><strong>이 사용자도 함께 차단</strong><small>프로필과 메시지가 서로 보이지 않아요.</small></span>
      </label>
      <div className="modal-footer"><button className="secondary-button" type="button" onClick={onCancel}>취소</button><button className="danger-button" type="button" onClick={onConfirm}><Flag size={16} /> 신고 보내기</button></div>
    </div>
  );
}

function OnboardingModal({ onClose, onToast }: { onClose: () => void; onToast: (message: string) => void }) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("conversation");
  const goals: Array<[string, LucideIcon, string, string]> = [
    ["conversation", MessageCircle, "일상 대화", "자연스럽고 편하게 말하기"],
    ["career", Trophy, "업무 · 커리어", "회의와 발표 자신감"],
    ["travel", Globe2, "여행", "현지에서 바로 쓰기"],
    ["exam", BookOpenCheck, "시험 · 자격", "정확한 문법과 어휘"],
  ];

  return (
    <div className="onboarding-content">
      <header>
        <button className="onboarding-brand" type="button"><span className="brand-mark"><Languages size={20} /></span><span className="brand-wordmark">Lingo<span>Loop</span></span></button>
        <span>STEP {step} / 3</span>
      </header>
      <div className="onboarding-progress"><i style={{ width: `${step * 33.333}%` }} /></div>

      {step === 1 ? (
        <section>
          <Pill tone="soft">LANGUAGE</Pill>
          <h2>어떤 언어를 함께 나누고 싶나요?</h2>
          <p>나중에 프로필에서 언제든 바꿀 수 있어요.</p>
          <div className="language-picker">
            <button className="selected" type="button"><span>🇰🇷</span><p><small>내 모국어</small><strong>한국어</strong></p><CheckCircle2 size={18} /></button>
            <button className="selected" type="button"><span>🇺🇸</span><p><small>배울 언어</small><strong>영어</strong></p><CheckCircle2 size={18} /></button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section>
          <Pill tone="soft">GOAL</Pill>
          <h2>지금 가장 중요한 학습 목표는?</h2>
          <p>추천 파트너와 연습 콘텐츠가 이 목표에 맞춰져요.</p>
          <div className="goal-picker">
            {goals.map(([id, GoalIcon, title, description]) => (
              <button className={goal === id ? "selected" : ""} type="button" key={id} onClick={() => setGoal(id)}>
                <GoalIcon size={19} /><span><strong>{title}</strong><small>{description}</small></span>{goal === id ? <CheckCircle2 size={18} /> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section>
          <Pill tone="soft">YOUR RHYTHM</Pill>
          <h2>언제, 어떻게 교정받고 싶나요?</h2>
          <p>편안한 대화를 위한 기본 약속을 정해요.</p>
          <div className="rhythm-options">
            <button type="button"><Clock3 size={18} /><span><strong>주 활동 시간</strong><small>평일 저녁 7–10시</small></span><ChevronDown size={16} /></button>
            <button type="button"><PenLine size={18} /><span><strong>교정 선호</strong><small>대화 후 중요한 오류만</small></span><ChevronDown size={16} /></button>
            <label><ShieldCheck size={18} /><span><strong>안전한 DM 요청함</strong><small>모르는 사람의 메시지를 먼저 검토</small></span><input aria-label="안전한 DM 요청함 사용" type="checkbox" defaultChecked /><i className="toggle" /></label>
          </div>
        </section>
      ) : null}

      <footer>
        <button className="secondary-button" type="button" onClick={() => step === 1 ? onClose() : setStep(step - 1)}>{step === 1 ? "나중에" : "이전"}</button>
        <button className="primary-button" type="button" onClick={() => { if (step < 3) setStep(step + 1); else { onClose(); onToast("학습 목표를 업데이트했어요"); } }}>{step < 3 ? "다음" : "추천 시작"}<ChevronRight size={16} /></button>
      </footer>
    </div>
  );
}
