/**
 * 더 찾아보기: 오늘 고른 사람 전부(서버가 하루 최대 12명)와 이름·관심사 검색.
 * 조건(알려 줄 말·나이·시간 등)은 "조건"에서 바꿉니다. 바꾸면 서버가 그날 추천을 바로 다시 고릅니다.
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { PersonRow } from "@/features/people/PersonRow";
import { useDailyMatches } from "@/features/today/data";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { languageName, matchReasonText } from "@/lib/words";
import { space } from "@/theme/tokens";
import { Card, SectionHeader } from "@/ui/Bits";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { Page } from "@/ui/Page";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { EmptyState, ErrorState, LoadingState } from "@/ui/States";

const COLUMN = 720;

export default function Discover() {
  const router = useRouter();
  const { state, reload } = useDailyMatches();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[] | null>(null);
  const [searchError, setSearchError] = useState("");
  const searching = query.trim().length >= 2;

  // 두 글자부터 찾습니다(서버 규칙). 입력을 멈추고 잠시 뒤에 한 번만 부릅니다.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      api<{ partners: Profile[] }>(`/api/search?q=${encodeURIComponent(text)}`)
        .then((data) => {
          if (!alive) return;
          setResults(data?.partners ?? []);
          setSearchError("");
        })
        .catch((caught) => {
          if (alive) setSearchError(failureText(caught, t("찾지 못했어요.")));
        });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const all = state.status === "ready" ? state.data.all : [];
  const targets = state.status === "ready" ? state.data.targetLanguages : [];

  return (
    <Page onRefresh={reload} refreshing={false}>
      <ScreenHeader title={t("더 찾아보기")} fallback="/" />
      <View style={{ width: "100%", maxWidth: COLUMN, gap: space.xl }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <TextField
              label={t("이름이나 관심사로 찾기")}
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                if (value.trim().length < 2) {
                  setResults(null);
                  setSearchError("");
                }
              }}
              placeholder={t("예: 영화, 여행, Emma")}
              maxLength={80}
            />
          </View>
          <Button label={t("조건")} icon="sliders" variant="secondary" onPress={() => router.push("/discover/filters")} />
        </View>

        {searching ? (
          searchError ? (
            <ErrorState message={searchError} />
          ) : !results ? (
            <LoadingState />
          ) : results.length === 0 ? (
            <EmptyState title={t("찾는 사람이 없어요")} body={t("다른 말로 찾아보거나 조건을 바꿔 보세요.")} />
          ) : (
            <Card padded={false}>
              {results.map((person, index) => (
                <PersonRow key={person.id} person={person} first={index === 0} />
              ))}
            </Card>
          )
        ) : (
          <View style={{ gap: space.md }}>
            <SectionHeader
              title={t("오늘의 추천")}
              detail={targets.length ? t("{language}를 알려 줄 사람 · 조건에 맞는 사람을 먼저 보여 줘요", { language: targets.map(languageName).join(" · ") }) : undefined}
            />
            {state.status === "loading" ? (
              <LoadingState />
            ) : state.status === "error" ? (
              <ErrorState message={state.error} onRetry={reload} />
            ) : all.length === 0 ? (
              <EmptyState
                title={t("오늘은 맞는 파트너를 찾지 못했어요")}
                body={t("알려 줄 말이나 조건을 바꾸면 바로 다시 찾아 드려요.")}
                action={<Button label={t("조건 바꾸기")} icon="sliders" variant="secondary" onPress={() => router.push("/discover/filters")} />}
              />
            ) : (
              <Card padded={false}>
                {all.map((item, index) => (
                  <PersonRow
                    key={item.partner.id}
                    person={item.partner}
                    first={index === 0}
                    reasons={
                      item.matchReasonCodes?.length
                        ? item.matchReasonCodes.map((reason, position) => matchReasonText(reason, item.matchReasons[position]))
                        : item.matchReasons
                    }
                  />
                ))}
              </Card>
            )}
          </View>
        )}
      </View>
    </Page>
  );
}
