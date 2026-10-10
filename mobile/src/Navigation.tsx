/**
 * 화면 배선.
 *
 * 아래 탭 넷(파트너·커뮤니티·대화·프로필)과, 각 탭 위에 쌓이는 상세 화면들입니다.
 * 웹은 사이드바 + 3단 레이아웃이지만 폰은 한 화면씩 쌓는 것이 맞습니다 —
 * 같은 컴포넌트로 둘 다 만들려 하면 양쪽 다 나빠집니다.
 */
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Alert, View, useColorScheme } from "react-native";
import type { ApiConversation } from "@shared/live-data";
import type { FeedPost, Conversation, Partner } from "@shared/demo-data";
import { post as apiPost } from "./lib/api";
import { ChatsProvider, useChats } from "./lib/chats";
import { t } from "./lib/i18n";
import { useTheme } from "./lib/useTheme";
import { HeaderButton } from "./ui";
import { ChatsScreen } from "./screens/ChatsScreen";
import { CommunityScreen } from "./screens/CommunityScreen";
import { ComposeScreen } from "./screens/ComposeScreen";
import { AvatarEditorScreen } from "./screens/AvatarEditorScreen";
import { EditProfileScreen } from "./screens/EditProfileScreen";
import { MeScreen } from "./screens/MeScreen";
import { PartnerProfileScreen } from "./screens/PartnerProfileScreen";
import { PartnersScreen } from "./screens/PartnersScreen";
import { PostDetailScreen } from "./screens/PostDetailScreen";
import { FiltersScreen } from "./screens/FiltersScreen";
import { LikesScreen } from "./screens/LikesScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { ThreadScreen } from "./screens/ThreadScreen";
import { HomeScreen, HomesScreen } from "./screens/HomesScreen";

export type RootParams = {
  Tabs: undefined;
  PartnerProfile: { partnerId: string };
  /** compose: 피드의 댓글·교정 단추로 열면 그 입력칸을 바로 엽니다. */
  PostDetail: { post: FeedPost; compose?: "reply" | "correction" };
  /** request: 내가 받은 메시지 요청. 수락하기 전에는 답장할 수 없습니다. */
  Thread: { conversation: Conversation; request?: boolean };
  Compose: undefined;
  EditProfile: undefined;
  AvatarEditor: undefined;
  Homes: undefined;
  Home: {ownerId:string};
  Filters: undefined;
  Likes: undefined;
  Search: undefined;
};

const Stack = createNativeStackNavigator<RootParams>();
const Tab = createBottomTabNavigator();

/**
 * 메시지 보내기.
 *
 * 대화가 없으면 서버가 만들어 줍니다. DM 규칙(서로 마음을 보냈거나 오늘의
 * 추천에 있어야 함)은 서버가 판단하므로, 막히면 서버가 준 이유가 그대로
 * 화면에 뜹니다 — 앱에서 같은 규칙을 다시 짜면 둘이 어긋납니다.
 */
async function openConversation(partner: Partner): Promise<RootParams["Thread"] | null> {
  try {
    const created = await apiPost<ApiConversation>("/api/conversations", {
      partnerId: partner.id,
    });
    return {
      conversation: {
        id: created.id,
        partnerId: partner.id,
        name: partner.name,
        handle: partner.handle,
        flag: partner.flag,
        accent: partner.accent,
        photo: partner.photo,
        avatarMode: partner.avatarMode,
        avatarConfig: partner.avatarConfig,
        countryCode: partner.countryCode,
        preview: "",
        time: "",
        unread: 0,
        online: partner.online,
        muted: Boolean(created.muted),
        language: partner.learning,
        messages: [],
      } as Conversation,
      // 상대가 먼저 보낸 요청이 있으면 그 방이 열립니다 — 수락 안내를 보여줘야 합니다.
      request: Boolean(created.isIncomingRequest),
    };
  } catch (error) {
    Alert.alert(t("요청을 처리하지 못했어요."),error instanceof Error?error.message:undefined);
    return null;
  }
}

function Tabs() {
  const c = useTheme();
  const { unread } = useChats();
  return (
    /* 탭마다 헤더를 답니다. 헤더가 없으면 내용이 상태바 밑으로 들어갑니다 —
       위쪽 안전 영역은 네비게이터가 헤더와 함께 계산해 줍니다. */
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.ink,
        headerTitleStyle: { fontSize: 18, fontWeight: "700" },
        headerShadowVisible: false,
        tabBarActiveTintColor: c.primaryStrong,
        tabBarInactiveTintColor: c.subtle,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tab.Screen
        name="PartnersTab"
        options={({ navigation }) => ({
          title: t("파트너"),
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} />,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 12 }}>
              <HeaderButton
                icon="heart-outline"
                label={t("받은 마음")}
                onPress={() => navigation.navigate("Likes")}
              />
              <HeaderButton
                icon="options-outline"
                label={t("조건 바꾸기")}
                onPress={() => navigation.navigate("Filters")}
              />
            </View>
          ),
        })}
      >
        {({ navigation }) => (
          <PartnersScreen
            onOpenProfile={(partnerId) => navigation.navigate("PartnerProfile", { partnerId })}
            onStartChat={async (partner) => {
              const thread = await openConversation(partner);
              if (thread) navigation.navigate("Thread", thread);
            }}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="CommunityTab"
        options={({ navigation }) => ({
          title: t("커뮤니티"),
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 12 }}>
              <HeaderButton icon="search" label={t("검색")} onPress={() => navigation.navigate("Search")} />
              <HeaderButton
                icon="create-outline"
                label={t("글쓰기")}
                onPress={() => navigation.navigate("Compose")}
              />
            </View>
          ),
        })}
      >
        {({ navigation }) => (
          <CommunityScreen
            onOpenPost={(post, compose) => navigation.navigate("PostDetail", { post, compose })}
            onOpenProfile={(partnerId) => navigation.navigate("PartnerProfile", { partnerId })}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="ChatsTab"
        options={{
          title: t("대화"),
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
          // 안 읽은 메시지 수. 목록의 안읽음 표시와 같은 노랑을 씁니다.
          tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: c.secondary, color: c.onSecondary, fontWeight: "800" },
        }}
      >
        {({ navigation }) => (
          <ChatsScreen onOpen={(conversation, request) => navigation.navigate("Thread", { conversation, request })} />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="MeTab"
        options={{
          title: t("프로필"),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      >
        {({ navigation }) => (
          <MeScreen
            onEdit={() => navigation.navigate("EditProfile")}
            onEditAvatar={() => navigation.navigate("AvatarEditor")}
            onHomes={(ownerId) => ownerId?navigation.navigate("Home",{ownerId}):navigation.navigate("Homes")}
            onOpenPost={(post) => navigation.navigate("PostDetail", { post })}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function Navigation() {
  const c = useTheme();
  const scheme = useColorScheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    // 대화 목록은 대화 탭·대화방·탭 배지가 함께 봅니다. 그래서 화면들 바깥에 둡니다.
    <ChatsProvider>
    <NavigationContainer
      theme={{
        ...base,
        colors: {
          ...base.colors,
          background: c.bg,
          card: c.surface,
          text: c.ink,
          border: c.line,
          primary: c.primaryStrong,
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.ink,
          headerTitleStyle: { fontSize: 17, fontWeight: "700" },
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />

        <Stack.Screen name="Homes" options={{title:t("친구 집 둘러보기")}}>
          {({navigation})=><HomesScreen onVisit={ownerId=>navigation.push('Home',{ownerId})}/>}
        </Stack.Screen>
        <Stack.Screen name="Home" options={{title:t("친구 집")}}>
          {({route,navigation})=><HomeScreen key={route.params.ownerId} ownerId={route.params.ownerId} onStartChat={async partner=>{const thread=await openConversation(partner);if(thread)navigation.navigate('Thread',thread);}}/>}
        </Stack.Screen>

        <Stack.Screen name="PartnerProfile" options={{ title: t("프로필") }}>
          {({ route, navigation }) => (
            <PartnerProfileScreen
              partnerId={route.params.partnerId}
              onVisitHome={(ownerId) => navigation.navigate("Home", {ownerId})}
              onOpenProfile={(partnerId) => navigation.push("PartnerProfile", { partnerId })}
              onOpenPost={(post) => navigation.navigate("PostDetail", { post })}
              onStartChat={async (partner) => {
                const thread = await openConversation(partner);
                if (thread) navigation.navigate("Thread", thread);
              }}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="PostDetail" options={{ title: t("글") }}>
          {({ route, navigation }) => (
            <PostDetailScreen
              post={route.params.post}
              compose={route.params.compose}
              onOpenProfile={(partnerId) => navigation.push("PartnerProfile", { partnerId })}
            />
          )}
        </Stack.Screen>

        {/* 제목은 상대 이름입니다. 옵션을 비워두면 화면 이름("Thread")이 그대로 나옵니다. */}
        <Stack.Screen
          name="Thread"
          options={({ route }) => ({ title: route.params.conversation.name })}
        >
          {/* 나가기·차단 뒤에는 탭 화면으로 돌아갑니다 — 차단한 사람의 프로필 위로 돌아가지 않게 합니다. */}
          {({ route, navigation }) => (
            <ThreadScreen
              conversation={route.params.conversation}
              request={route.params.request}
              onClose={() => navigation.popToTop()}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Compose" options={{ title: t("글쓰기"), presentation: "modal" }}>
          {({ navigation }) => <ComposeScreen onDone={() => navigation.goBack()} />}
        </Stack.Screen>

        <Stack.Screen name="EditProfile" options={{ title: t("프로필 편집"), presentation: "modal" }}>
          {({ navigation }) => (
            <EditProfileScreen
              onDone={() => navigation.goBack()}
              onEditAvatar={() => navigation.navigate("AvatarEditor")}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="AvatarEditor"
          options={{ headerShown: false, headerBackButtonMenuEnabled: false, presentation: "modal" }}
        >
          {({ navigation }) => <AvatarEditorScreen onDone={() => navigation.goBack()} />}
        </Stack.Screen>

        <Stack.Screen name="Filters" options={{ title: t("오늘의 파트너 조건"), presentation: "modal" }}>
          {({ navigation }) => <FiltersScreen onDone={() => navigation.goBack()} />}
        </Stack.Screen>

        <Stack.Screen name="Likes" options={{ title: t("받은 마음") }}>
          {({ navigation }) => (
            <LikesScreen
              onOpenProfile={(partnerId) => navigation.navigate("PartnerProfile", { partnerId })}
              onStartChat={async (partner) => {
                const thread = await openConversation(partner);
                if (thread) navigation.navigate("Thread", thread);
              }}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Search" options={{ title: t("검색") }}>
          {({ navigation }) => (
            <SearchScreen
              onOpenProfile={(partnerId) => navigation.navigate("PartnerProfile", { partnerId })}
              onOpenPost={(post) => navigation.navigate("PostDetail", { post })}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
    </ChatsProvider>
  );
}
