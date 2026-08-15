"use client";

import { useState } from "react";
import {
  Heart, MessageCircle, Repeat2, Send, MoreHorizontal, Plus,
  Home, Search, PenSquare, Bell, User, Moon, Sun,
  Image as ImageIcon, Mic, Globe2, LockKeyhole, Inbox,
  BarChart3, Bookmark, UserPlus, Menu, Compass, Instagram, SquarePen,
} from "lucide-react";
import {
  UIScope, Button, IconButton, Avatar, Pill, Divider, ThreadItem, Action,
  Input, Composer, Sheet, Header, TabBar, PostRow,
  Toast, Switch, SettingRow, Field, ChipSelect, Badge, EmptyState,
  AttachCard, MessageBubble, TypingIndicator, QuotePost, FAB,
  SearchField, ConversationRow, PageIndicator,
  Sidebar, SidebarGroup, SidebarItem, SidebarSection, FeedCard, ActivityRow,
  ProfileHeader, Tabs, ComposerTrigger, LinkPreview,
  SplitLayout, Panel, FilterChips, ChatHeader, ChatEmptyState,
} from "../components/ui";

const TABS = [
  { id: "home", label: "홈", icon: Home },
  { id: "search", label: "검색", icon: Search },
  { id: "compose", label: "작성", icon: PenSquare },
  { id: "activity", label: "알림", icon: Bell },
  { id: "profile", label: "프로필", icon: User },
];

export default function UIPreviewPage() {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("home");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [profileTab, setProfileTab] = useState("posts");
  const [inbox, setInbox] = useState("inbox");
  const [notify, setNotify] = useState(true);
  const [chips, setChips] = useState<string[]>(["ko"]);
  const [toast, setToast] = useState<string | null>(null);

  const say = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  return (
    <UIScope className="ui-preview">
      <div data-theme={dark ? "dark" : "light"} className="ui-scope" style={{ minHeight: "100vh", background: "var(--ui-base)" }}>
        <Header
          title="UI 프리미티브"
          right={
            <IconButton
              label={dark ? "라이트 모드" : "다크 모드"}
              icon={dark ? Sun : Moon}
              onClick={() => setDark((v) => !v)}
            />
          }
        />

        <div style={{ maxWidth: 620, margin: "0 auto", padding: "0 24px 24px" }}>
          <section style={{ marginTop: 24 }}>
            <p className="ui-caption">Button — 높이 36 · radius 10 (실측)</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <Button>팔로우</Button>
              <Button variant="secondary">팔로잉</Button>
              <Button variant="ghost">취소</Button>
              <Button variant="accent" icon={Plus}>대화 시작</Button>
              <Button size="sm" variant="secondary">작게</Button>
              <Button disabled>비활성</Button>
              <Button disabled className="ui-button-outlined-off">게시</Button>
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <p className="ui-caption">Avatar · Pill · IconButton</p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <Avatar name="Maya" size="sm" />
              <Avatar name="Noah" online />
              <Avatar name="서준" size="lg" />
              <Pill>English</Pill>
              <Pill tone="outline">중급</Pill>
              <Pill tone="accent">매칭됨</Pill>
              <IconButton label="더보기" icon={MoreHorizontal} muted />
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <p className="ui-caption">Input · Composer</p>
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <Input placeholder="파트너 검색" />
              <div style={{ display: "flex", gap: 12 }}>
                <Avatar name="나" size="sm" />
                <Composer
                  placeholder="새로운 소식이 있나요?"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </div>
              <div>
                <Button size="sm" disabled={!draft} className={draft ? "" : "ui-button-outlined-off"}>
                  게시
                </Button>
              </div>
            </div>
          </section>

          <Divider />

          <section style={{ marginTop: 24 }}>
            <p className="ui-caption" style={{ marginBottom: 12 }}>PostRow — 연결선</p>

            <PostRow
              author="maya"
              time="2시간"
              avatar={<Avatar name="Maya" online />}
              connected
              menu={<IconButton label="게시물 옵션" icon={MoreHorizontal} muted />}
              body={<>한국어로 “수고하셨습니다”를 영어로 어떻게 옮기는 게 자연스러울까요? <PageIndicator current={1} total={2} /></>}
              actions={
                <>
                  <Action label="좋아요" icon={Heart} count={12} active />
                  <Action label="답글" icon={MessageCircle} count={3} />
                  <Action label="공유" icon={Repeat2} />
                  <Action label="공유" icon={Send} />
                </>
              }
            />

            <PostRow
              author="noah.codes"
              time="1시간"
              avatar={<Avatar name="Noah" size="sm" />}
              connected
              body="상황에 따라 달라요. 퇴근할 때면 “Have a good evening” 쪽이 자연스럽습니다."
              actions={
                <>
                  <Action label="좋아요" icon={Heart} count={4} />
                  <Action label="답글" icon={MessageCircle} />
                </>
              }
            />

            <ThreadItem avatar={<Avatar name="서준" size="sm" />}>
              <p className="ui-body"><span className="ui-strong">seojun</span> <span className="ui-meta">40분</span></p>
              <p className="ui-post-text">직역이 없는 표현이라 저도 늘 고민이었어요. 감사합니다!</p>
            </ThreadItem>
          </section>

          <Divider />

          <section style={{ marginTop: 24 }}>
            <p className="ui-caption">Setting · Switch · Field · ChipSelect</p>
            <div style={{ marginTop: 12 }}>
              <SettingRow
                icon={Bell}
                title="학습 알림"
                description="매일 오전 9시에 오늘의 파트너를 알려드려요"
                action={<Switch label="학습 알림" checked={notify} onChange={setNotify} />}
              />
              <SettingRow
                icon={LockKeyhole}
                title="프로필 공개 범위"
                description="매칭된 파트너에게만 공개"
                action={<Badge count={3} />}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="희망 학습 언어" hint="여러 개 고를 수 있어요">
                <ChipSelect
                  options={[
                    { id: "ko", label: "한국어" },
                    { id: "en", label: "English" },
                    { id: "ja", label: "日本語" },
                  ]}
                  selected={chips}
                  onToggle={(id) =>
                    setChips((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
                  }
                />
              </Field>
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <p className="ui-caption">DM — 말풍선(radius 18 · 꼬리 4 실측) · 대화 목록 · 검색</p>
            <div style={{ marginTop: 12 }}>
              <SearchField icon={Search} placeholder="검색" />
            </div>
            <div style={{ marginTop: 12 }}>
              <ConversationRow
                avatar={<Avatar name="Maya" size="lg" online />}
                name="maya"
                preview="그럼 내일 저녁에 얘기해요!"
                time="19:04"
                unread={2}
                onClick={() => say("대화를 열었어요")}
              />
              <ConversationRow
                avatar={<Avatar name="Noah" size="lg" />}
                name="noah.codes"
                preview="Have a good evening 쪽이 자연스러워요"
                time="어제"
                onClick={() => say("대화를 열었어요")}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <MessageBubble text="오늘 저녁에 30분 정도 가능하세요?" time="19:02" />
              <MessageBubble text="시간 맞으면 발음도 봐드릴게요" tail />
              <MessageBubble text="네! 8시부터 괜찮아요" time="19:04" mine tail />
              <TypingIndicator />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <AttachCard icon={ImageIcon} label="사진" onClick={() => say("사진을 첨부했어요")} />
              <AttachCard icon={Mic} label="음성" onClick={() => say("음성 메시지를 녹음해요")} />
              <AttachCard icon={Globe2} label="번역" onClick={() => say("번역을 요청했어요")} />
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <p className="ui-caption">QuotePost — 인용 카드 (radius 8 · 1px 테두리 실측)</p>
            <div style={{ marginTop: 12 }}>
              <PostRow
                author="maya"
                time="2시간"
                avatar={<Avatar name="Maya" />}
                body="이 표현 정리 너무 좋아요. 저도 저장해둡니다."
                actions={
                  <>
                    <Action label="좋아요" icon={Heart} count={8} />
                    <Action label="답글" icon={MessageCircle} count={1} />
                  </>
                }
              />
              <div style={{ marginLeft: 48, marginTop: -12, marginBottom: 24 }}>
                <QuotePost>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name="서준" size="xs" />
                    <span className="ui-post-author">seojun</span>
                    <span className="ui-post-time">2026-08-14</span>
                  </div>
                  <p className="ui-post-text">
                    &ldquo;수고하셨습니다&rdquo;는 상황마다 달라요. 퇴근 · 발표 후 · 운동 후 표현을 정리했습니다.
                  </p>
                </QuotePost>
              </div>
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <p className="ui-caption">EmptyState</p>
            <EmptyState
              icon={Inbox}
              title="아직 대화가 없어요"
              description="오늘의 파트너에게 먼저 인사를 건네보세요"
              action={<Button size="sm" variant="secondary" onClick={() => say("파트너 탭으로 이동")}>파트너 보기</Button>}
            />
          </section>

          <section style={{ marginTop: 24 }}>
            <p className="ui-caption">Sidebar — 활성은 굵기가 아니라 배경 채움</p>
            <div style={{ display: "flex", marginTop: 12, border: "0.5px solid var(--ui-divider)", borderRadius: 16, overflow: "hidden" }}>
              <Sidebar>
                <SidebarGroup>
                  <SidebarItem icon={Home} label="추천" />
                  <SidebarItem icon={Plus} label="새 게시물" />
                  <SidebarItem icon={Search} label="검색" />
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarItem icon={Send} label="메시지" />
                  <SidebarItem icon={Heart} label="활동" active />
                  <SidebarItem icon={User} label="프로필" />
                  <SidebarItem icon={BarChart3} label="인사이트" />
                  <SidebarItem icon={Bookmark} label="저장됨" />
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarSection title="피드" action={<button type="button">수정</button>} />
                  <SidebarItem icon={Compass} label="팔로잉" />
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarItem icon={Menu} label="더 보기" />
                </SidebarGroup>
              </Sidebar>
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <p className="ui-caption">ActivityRow — 구분선이 아바타를 건너뜁니다</p>
            <div style={{ marginTop: 12 }}>
              <FeedCard>
                <ActivityRow
                  avatar={<Avatar name="johyer" />}
                  name="johyer1"
                  time="4일"
                  kind="추천 게시물"
                  body="안녕하세요. 한국어 교환 파트너를 찾고 있습니다. 저는 영어와 일본어를 할 수 있어요."
                  actions={
                    <>
                      <Action label="좋아요" icon={Heart} count={89} />
                      <Action label="답글" icon={MessageCircle} count={7} />
                      <Action label="공유" icon={Repeat2} count={1} />
                      <Action label="공유" icon={Send} />
                    </>
                  }
                />
                <ActivityRow
                  avatar={<Avatar name="nannu" badge={UserPlus} />}
                  name="nannuuul_"
                  time="6일"
                  kind="팔로우 추천"
                />
                <ActivityRow
                  avatar={<Avatar name="서준" />}
                  name="seojun"
                  time="2주"
                  kind="추천 게시물"
                  body="오늘 배운 표현 정리했습니다. 저장해두고 복습하세요!"
                  actions={
                    <>
                      <Action label="좋아요" icon={Heart} count={507} active />
                      <Action label="답글" icon={MessageCircle} count={48} />
                    </>
                  }
                />
              </FeedCard>
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <p className="ui-caption">Profile — 밑줄 탭 · 아바타 스택 · 작성 트리거 · 링크 카드</p>
            <div style={{ marginTop: 12 }}>
              <FeedCard>
                <ProfileHeader
                  name="baemhyuk"
                  handle="baemhyuk"
                  bio="🐰🐰"
                  avatar={<Avatar name="배민혁" size="xl" />}
                  followers="팔로워 71명"
                  followerAvatars={
                    <>
                      <Avatar name="Maya" size="xs" />
                      <Avatar name="Noah" size="xs" />
                      <Avatar name="서준" size="xs" />
                    </>
                  }
                  links={
                    <>
                      <IconButton label="인사이트" icon={BarChart3} />
                      <IconButton label="인스타그램" icon={Instagram} />
                    </>
                  }
                  action={<Button variant="secondary" block>프로필 편집</Button>}
                />
                <Tabs
                  tabs={[
                    { id: "posts", label: "게시물" },
                    { id: "replies", label: "답글" },
                    { id: "media", label: "미디어" },
                    { id: "saved", label: "저장" },
                  ]}
                  active={profileTab}
                  onSelect={setProfileTab}
                />
                <ComposerTrigger
                  avatar={<Avatar name="배민혁" size="sm" />}
                  placeholder="새로운 소식이 있나요?"
                  action={<Button size="sm" disabled className="ui-button-outlined-off">게시</Button>}
                  onClick={() => setSheetOpen(true)}
                />
                <div style={{ padding: "12px 16px 0" }}>
                  <PostRow
                    author="baemhyuk"
                    topic="일본부동산"
                    time="31분"
                    avatar={<Avatar name="배민혁" />}
                    menu={<IconButton label="게시물 옵션" icon={MoreHorizontal} muted />}
                    body={
                      <>
                        일본에서 부동산 관련업 하시는 분들께 여쭙고 싶습니다. 동네 추천 서비스를 만들고 있습니다.
                        <LinkPreview domain="app.sonar.place" onClick={() => say("링크를 열었어요")} />
                      </>
                    }
                    actions={
                      <>
                        <Action label="좋아요" icon={Heart} />
                        <Action label="답글" icon={MessageCircle} />
                        <Action label="공유" icon={Repeat2} />
                        <Action label="공유" icon={Send} />
                      </>
                    }
                  />
                </div>
              </FeedCard>
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <p className="ui-caption">Messages — 목록 패널 + 대화 패널</p>
            <div style={{ marginTop: 12, height: 380, overflow: "hidden", border: "0.5px solid var(--ui-divider)", borderRadius: 16 }}>
              <SplitLayout>
                <Panel title="메시지" action={<IconButton label="새 메시지" icon={SquarePen} />}>
                  <div className="ui-panel-pad">
                    <SearchField icon={Search} placeholder="검색" />
                  </div>
                  <div className="ui-panel-pad">
                    <FilterChips
                      options={[
                        { id: "inbox", label: "받은 메시지함" },
                        { id: "requests", label: "요청" },
                      ]}
                      active={inbox}
                      onSelect={setInbox}
                    />
                  </div>
                  <ConversationRow
                    avatar={<Avatar name="Maya" size="lg" />}
                    name="maya"
                    preview="그럼 내일 저녁에 얘기해요! · 2주"
                    onClick={() => say("대화를 열었어요")}
                  />
                  <ConversationRow
                    avatar={<Avatar name="Noah" size="lg" />}
                    name="noah.codes"
                    preview="알겠습니다 인스타로 부탁드릴게요! · 7주"
                    onClick={() => say("대화를 열었어요")}
                  />
                </Panel>
                <div className="ui-detail">
                  <ChatHeader
                    avatar={<Avatar name="Maya" size="sm" />}
                    name="maya"
                    subtitle="Maya Chen"
                    verified
                  />
                  <ChatEmptyState
                    logo={<Avatar name="Maya" size="xl" />}
                    title="maya"
                    description="아직 주고받은 메시지가 없어요. 먼저 인사를 건네보세요."
                  />
                </div>
              </SplitLayout>
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <p className="ui-caption">Sheet · Toast</p>
            <div style={{ marginTop: 12 }}>
              <Button variant="secondary" onClick={() => setSheetOpen(true)}>모달 열기</Button>
              <Button variant="ghost" onClick={() => say("토스트 메시지입니다")}>토스트</Button>
            </div>
          </section>
        </div>

        <TabBar tabs={TABS} active={tab} onSelect={setTab} />

        <FAB icon={PenSquare} label="새 글 작성" onClick={() => setSheetOpen(true)} />

        <Toast message={toast} />

        {sheetOpen ? (
          <Sheet
            title="새 게시물"
            onClose={() => setSheetOpen(false)}
            headAction={<Button size="sm" onClick={() => setSheetOpen(false)}>게시</Button>}
          >
            <div style={{ display: "flex", gap: 12 }}>
              <Avatar name="나" size="sm" />
              <Composer placeholder="새로운 소식이 있나요?" />
            </div>
          </Sheet>
        ) : null}
      </div>
    </UIScope>
  );
}
