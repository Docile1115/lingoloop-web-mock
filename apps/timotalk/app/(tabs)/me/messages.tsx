/**
 * 받는 메시지. 서버의 DM 정책(GET·POST /api/dm/privacy, backend/policy.mjs)을 고칩니다.
 *  - whoCanMessage: 바로 대화가 열리는 사람. "matches" 는 내 오늘의 파트너에 나온 사람(또는 서로 마음을 보낸 사람)입니다.
 *  - routeOthersToRequests: 그 밖의 사람의 인사를 요청함으로 받을지(끄면 보낼 수 없음)
 *  - flagSuspectedSpam: 요청함 첫 메시지의 스팸 신호 표시(막지는 않음)
 * 팔로우 기반 범위(followers·mutual-follows)는 새 앱에서 고르지 않습니다. 예전 웹에서 고른 값이면 그대로 보여 줍니다.
 * 고르면 바로 저장하고, 실패하면 이전 값으로 되돌립니다.
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { space } from "@/theme/tokens";
import { ListGroup, RadioRow, SwitchRow } from "@/ui/List";
import { Page } from "@/ui/Page";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { ErrorState, LoadingState } from "@/ui/States";
import { showToast } from "@/ui/Toast";

type Privacy = { whoCanMessage: string; routeOthersToRequests: boolean; flagSuspectedSpam: boolean };

function normalize(settings: Partial<Privacy> | undefined): Privacy {
  const scope = settings?.whoCanMessage === "all" ? "everyone" : settings?.whoCanMessage || "matches";
  return {
    whoCanMessage: scope,
    routeOthersToRequests: settings?.routeOthersToRequests !== false,
    flagSuspectedSpam: settings?.flagSuspectedSpam !== false,
  };
}

export default function MessageSettings() {
  const [settings, setSettings] = useState<Privacy | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ settings: Partial<Privacy> }>("/api/dm/privacy")
      .then((data) => {
        if (alive) setSettings(normalize(data.settings));
      })
      .catch((caught) => {
        if (alive) setLoadError(failureText(caught, t("불러오지 못했어요.")));
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const update = async (patch: Partial<Privacy>) => {
    if (!settings || saving) return;
    const previous = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      const saved = await api<{ settings: Partial<Privacy> }>("/api/dm/privacy", { body: next });
      setSettings(normalize(saved.settings));
      showToast(t("저장했어요"));
    } catch (caught) {
      setSettings(previous);
      showToast(failureText(caught, t("저장하지 못했어요. 다시 시도해 주세요.")), "error");
    } finally {
      setSaving(false);
    }
  };

  const scope = settings?.whoCanMessage;
  const legacy = scope === "followers" || scope === "mutual-follows";

  return (
    <Page>
      <ScreenHeader title={t("받는 메시지")} detail={t("누가 나에게 대화를 걸 수 있는지 정해요.")} fallback="/me" />
      <View style={{ width: "100%", maxWidth: 560, gap: space.xxl }}>
        {loadError ? (
          <ErrorState
            message={loadError}
            onRetry={() => {
              setLoadError("");
              setAttempt((n) => n + 1);
            }}
          />
        ) : !settings ? (
          <LoadingState />
        ) : (
          <>
            <View accessibilityRole="radiogroup" aria-label={t("바로 대화가 열리는 사람")}>
              <ListGroup title={t("바로 대화가 열리는 사람")}>
                <RadioRow
                  title={t("오늘의 파트너로 만난 사람")}
                  detail={t("내 오늘의 파트너에 나온 사람이 인사하면 바로 대화가 열려요.")}
                  selected={scope === "matches"}
                  disabled={saving}
                  onPress={() => void update({ whoCanMessage: "matches" })}
                />
                <RadioRow
                  title={t("누구나")}
                  detail={t("누가 인사하든 바로 대화가 열려요.")}
                  selected={scope === "everyone"}
                  disabled={saving}
                  onPress={() => void update({ whoCanMessage: "everyone" })}
                />
                {legacy ? (
                  <RadioRow
                    title={scope === "followers" ? t("나를 팔로우한 사람") : t("서로 팔로우한 사람")}
                    detail={t("예전 웹에서 고른 설정이에요. 다른 것을 고르면 사라져요.")}
                    selected
                    disabled={saving}
                    onPress={() => undefined}
                  />
                ) : null}
              </ListGroup>
            </View>

            <ListGroup title={t("그 밖의 사람")}>
              <SwitchRow
                title={t("요청함으로 받기")}
                detail={
                  scope === "everyone"
                    ? t("누구나 바로 대화할 수 있어서 요청함을 거치지 않아요.")
                    : t("끄면 위에서 고른 사람 말고는 인사를 보낼 수 없어요.")
                }
                value={settings.routeOthersToRequests}
                disabled={saving || scope === "everyone"}
                onValueChange={(value) => void update({ routeOthersToRequests: value })}
              />
            </ListGroup>

            <ListGroup title={t("안전")}>
              <SwitchRow
                title={t("스팸 의심 표시")}
                detail={t("요청함의 첫 메시지에 링크·연락처·돈 이야기가 있으면 표시해요. 막지는 않아요.")}
                value={settings.flagSuspectedSpam}
                disabled={saving}
                onValueChange={(value) => void update({ flagSuspectedSpam: value })}
              />
            </ListGroup>
          </>
        )}
      </View>
    </Page>
  );
}
