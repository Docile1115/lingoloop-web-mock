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
import { useColorScheme } from "react-native";
import type { FeedPost, Conversation, Partner } from "@shared/demo-data";
import { post as apiPost } from "./lib/api";
import { t } from "./lib/i18n";
import { useTheme } from "./lib/useTheme";
import { ChatsScreen } from "./screens/ChatsScreen";
import { CommunityScreen } from "./screens/CommunityScreen";
import { ComposeScreen } from "./screens/ComposeScreen";
import { EditProfileScreen } from "./screens/EditProfileScreen";
import { MeScreen } from "./screens/MeScreen";
import { PartnerProfileScreen } from "./screens/PartnerProfileScreen";
import { PartnersScreen } from "./screens/PartnersScreen";
import { PostDetailScreen } from "./screens/PostDetailScreen";
import { ThreadScreen } from "./screens/ThreadScreen";

export type RootParams = {
  Tabs: undefined;
  PartnerProfile: { partnerId: string };
  PostDetail: { post: FeedPost };
  Thread: { conversation: Conversation };
  Compose: undefined;
  EditProfile: undefined;
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
async function openConversation(partner: Partner): Promise<Conversation | null> {
  try {
    const created = await apiPost<{ id: string }>("/api/conversations", {
      partnerId: partner.id,
    });
    return {
      id: created.id,
      partnerId: partner.id,
      name: partner.name,
      handle: partner.handle,
      flag: partner.flag,
      accent: partner.accent,
      photo: partner.photo,
      countryCode: partner.countryCode,
      preview: "",
      time: "",
      unread: 0,
      online: partner.online,
      language: partner.learning,
      messages: [],
    } as Conversation;
  } catch {
    return null;
  }
}

function Tabs() {
  const c = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primaryStrong,
        tabBarInactiveTintColor: c.subtle,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
      }}
    >
      <Tab.Screen
        name="PartnersTab"
        options={{
          title: t("파트너"),
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} />,
        }}
      >
        {({ navigation }) => (
          <PartnersScreen
            onOpenProfile={(partnerId) => navigation.navigate("PartnerProfile", { partnerId })}
            onStartChat={async (partner) => {
              const conversation = await openConversation(partner);
              if (conversation) navigation.navigate("Thread", { conversation });
            }}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="CommunityTab"
        options={{
          title: t("커뮤니티"),
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      >
        {({ navigation }) => (
          <CommunityScreen
            onOpenPost={(post) => navigation.navigate("PostDetail", { post })}
            onOpenProfile={(partnerId) => navigation.navigate("PartnerProfile", { partnerId })}
            onCompose={() => navigation.navigate("Compose")}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="ChatsTab"
        options={{
          title: t("대화"),
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
        }}
      >
        {({ navigation }) => (
          <ChatsScreen onOpen={(conversation) => navigation.navigate("Thread", { conversation })} />
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

        <Stack.Screen name="PartnerProfile" options={{ title: t("프로필") }}>
          {({ route, navigation }) => (
            <PartnerProfileScreen
              partnerId={route.params.partnerId}
              onOpenProfile={(partnerId) => navigation.push("PartnerProfile", { partnerId })}
              onOpenPost={(post) => navigation.navigate("PostDetail", { post })}
              onStartChat={async (partner) => {
                const conversation = await openConversation(partner);
                if (conversation) navigation.navigate("Thread", { conversation });
              }}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="PostDetail" options={{ title: t("글") }}>
          {({ route, navigation }) => (
            <PostDetailScreen
              post={route.params.post}
              onOpenProfile={(partnerId) => navigation.push("PartnerProfile", { partnerId })}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Thread">
          {({ route }) => <ThreadScreen conversation={route.params.conversation} />}
        </Stack.Screen>

        <Stack.Screen name="Compose" options={{ title: t("글쓰기"), presentation: "modal" }}>
          {({ navigation }) => <ComposeScreen onDone={() => navigation.goBack()} />}
        </Stack.Screen>

        <Stack.Screen name="EditProfile" options={{ title: t("프로필 편집"), presentation: "modal" }}>
          {({ navigation }) => <EditProfileScreen onDone={() => navigation.goBack()} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
