/**
 * Per-lift session block for the log page.
 * Owns lift-level suggestions, strength context, PR celebration, and set rows.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { ChevronRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useReadLocalStorage } from "usehooks-ts";

import { useUserLiftingData, isOwnData } from "@/hooks/use-userlift-data";
import { getTopLiftStats, useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { getDefaultBarbellWeight } from "@/lib/barbell-defaults";
import {
  getEffectiveSetForRanking,
  getOptimisticRankingMeta,
  getSetIdentityKey,
} from "@/lib/pr-ranking";
import {
  CELEBRATION_TIERS,
  fireSetCelebrationConfetti,
  getCelebrationTier,
  getTrainingAgeYears,
} from "@/lib/celebration";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getDisplayWeight } from "@/lib/processing-utils";
import {
  getLiftSessionHistory,
  getProgressionBadges,
} from "@/lib/log-progression";
import { getVideoSourceMeta } from "@/lib/video-thumbnails";
import { isValidLiftWeight } from "@/lib/import/parsers/parser-utilities";
import {
  getStrengthStandard,
  StrengthBar,
  StrengthLevelTooltipBody,
} from "@/components/log/strength-bar";
import { LiftPercentileLine } from "@/components/log/lift-percentile-line";
import {
  LiftStrengthLevel,
  LiftTonnageRow,
} from "@/components/home-dashboard/session-exercise-block";
import { getLiftDetailUrl } from "@/components/lift-type-indicator";
import {
  LiftSuggestions,
  LiftTechniqueAssist,
  LiftVideoThumb,
  SmartAddButtons,
} from "@/components/log/add-controls";
import { CustomSetDraftRow } from "@/components/log/custom-set-draft-row";
import { SetRow } from "@/components/log/set-row";
import { getLiftBlockCoachingState } from "@/components/log/lift-block-coaching-state";
import { getAutoTimestampNotes } from "@/components/log/sheet-snapshot-utils";
import { getLiftArtwork } from "@/components/lift-artwork";

export function LiftBlock({
  liftType,
  sets,
  parsedData,
  sessionDate,
  isMetric,
  topLiftsByTypeAndReps,
  topLiftsByTypeAndRepsLast12Months,
  tonnageStats,
  dashboardStage,
  sessionCount = 0,
  isPastSession,
  isStructuralSaving = false,
  isAddSaving = false,
  isDeleteCooldownActive = false,
  collapseSuggestions = false,
  onUpdateSet,
  onDeleteSet,
  onAddSet,
  onNavigateToDate,
  previewMode = false,
  usedSessionUrls,
  onSessionUrlAccepted,
  onSessionUrlReleased,
}) {
  const { dataSource } = useUserLiftingData();
  const { age, bodyWeight, sex, standards } = useAthleteBio();
  const { getColor } = useLiftColors();
  const prefersReducedMotion = useReducedMotion();
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";
  const hasBioData =
    age && bodyWeight && standards && Object.keys(standards).length > 0;

  // Only use confirmed (non-pending) sets for last-set reference
  const realSets = sets.filter((s) => !s._pending);
  const lastRealSet = realSets[realSets.length - 1];
  // Any lift we have drawn gets its diagram, not only the Big Four.
  const artworkSrc = getLiftArtwork(liftType);
  const liftColor = getColor(liftType);
  const liftBlockRef = useRef(null);
  const shakeTimerRef = useRef(null);
  const activeCelebrationTimerRef = useRef(null);
  const initialCelebrationPassRef = useRef(true);
  const previousCelebrationKeysRef = useRef(new Map());
  const [isCelebrationShaking, setIsCelebrationShaking] = useState(false);
  const [activeCelebrationKey, setActiveCelebrationKey] = useState(null);
  const [optimisticFieldsByKey, setOptimisticFieldsByKey] = useState({});
  const [customDraftSeed, setCustomDraftSeed] = useState(0);
  const [customDraftConfig, setCustomDraftConfig] = useState(null);
  const [initialPassiveRowKeys] = useState(
    () =>
      new Set(
        sets.map((set, index) => getSetIdentityKey(set, `initial-${index}`)),
      ),
  );
  const [initialPassiveRowOrder] = useState(
    () =>
      new Map(
        sets.map((set, index) => [
          getSetIdentityKey(set, `initial-${index}`),
          index,
        ]),
      ),
  );
  const canEditSets =
    !previewMode && !isStructuralSaving && typeof onUpdateSet === "function";
  const canDeleteSets = !previewMode && typeof onDeleteSet === "function";
  const canAddSets = !previewMode && typeof onAddSet === "function";
  const trainingAgeYears = useMemo(
    () => getTrainingAgeYears(parsedData, sessionDate),
    [parsedData, sessionDate],
  );

  const handleOptimisticFieldsChange = useCallback((rowKey, fields) => {
    if (!rowKey) return;
    setOptimisticFieldsByKey((prev) => {
      if (!fields) {
        if (!(rowKey in prev)) return prev;
        const next = { ...prev };
        delete next[rowKey];
        return next;
      }

      const current = prev[rowKey];
      if (
        current &&
        current.reps === fields.reps &&
        current.weight === fields.weight &&
        current.unitType === fields.unitType &&
        current.notes === fields.notes &&
        current.url === fields.url
      ) {
        return prev;
      }

      return {
        ...prev,
        [rowKey]: fields,
      };
    });
  }, []);

  // Show a one-time hint for new users (first ~20 sessions)
  const showSuggestionHint = useMemo(() => {
    if (!parsedData) return false;
    const dates = new Set();
    for (const e of parsedData) {
      dates.add(e.date);
    }
    return dates.size <= 20;
  }, [parsedData]);

  const closeCustomSetDraft = useCallback(() => {
    setCustomDraftConfig(null);
  }, []);

  // Reserve the video column for the whole lift once any of its sets carries a
  // playable link, so the marks line up and the notes column stops jumping
  // between filmed and unfilmed rows.
  const hasAnyVideo = useMemo(
    () =>
      sets.some((set) => {
        // Matches the key SetRow reports its optimistic fields under.
        const url =
          optimisticFieldsByKey[getSetIdentityKey(set)]?.url ?? set.URL ?? "";
        return Boolean(getVideoSourceMeta(url));
      }),
    [sets, optimisticFieldsByKey],
  );

  const optimisticSetsForStrength = useMemo(
    () =>
      sets.map((set, index) =>
        getEffectiveSetForRanking(
          set,
          optimisticFieldsByKey[getSetIdentityKey(set, `set-${index}`)],
        ),
      ),
    [sets, optimisticFieldsByKey],
  );

  // Today's heaviest set. It headlines the card, and rows well under it read
  // as warm-ups and sit back.
  const { sessionTopWeight, topSetLabel } = useMemo(() => {
    let top = null;
    let topValue = 0;
    for (const s of optimisticSetsForStrength) {
      if (!(s.reps > 0) || !(s.weight > 0)) continue;
      const { value } = getDisplayWeight(s, isMetric);
      if (value > topValue || (value === topValue && s.reps > top.reps)) {
        top = s;
        topValue = value;
      }
    }
    if (!top) return { sessionTopWeight: 0, topSetLabel: null };
    const { value, unit } = getDisplayWeight(top, isMetric);
    return {
      sessionTopWeight: topValue,
      topSetLabel: `${top.reps}@${value}${unit}`,
    };
  }, [optimisticSetsForStrength, isMetric]);

  // Recompute tonnage stats using optimistic reps/weight so the tonnage
  // row updates instantly as the user edits inline.
  const optimisticTonnageStats = useMemo(() => {
    if (!tonnageStats) return null;
    const optimisticTonnage = optimisticSetsForStrength.reduce(
      (sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0),
      0,
    );
    if (optimisticTonnage === tonnageStats.currentLiftTonnage)
      return tonnageStats;
    const { avgLiftTonnage } = tonnageStats;
    return {
      ...tonnageStats,
      currentLiftTonnage: optimisticTonnage,
      pctDiff:
        avgLiftTonnage > 0
          ? ((optimisticTonnage - avgLiftTonnage) / avgLiftTonnage) * 100
          : null,
      shouldShowComparison:
        optimisticSetsForStrength.length >= 4 ||
        (avgLiftTonnage > 0 && optimisticTonnage >= avgLiftTonnage * 0.4),
    };
  }, [tonnageStats, optimisticSetsForStrength]);

  // The heaviest this lift has ever gone, in the unit a custom set would be
  // entered in. The draft row uses it to catch a slipped extra digit.
  const customSetUnitType = lastRealSet?.unitType ?? (isMetric ? "kg" : "lb");
  const heaviestWeight = useMemo(() => {
    const lanes = topLiftsByTypeAndReps?.[liftType];
    if (!Array.isArray(lanes)) return null;
    let heaviest = 0;
    for (const lane of lanes) {
      const top = lane?.[0];
      if (!top) continue;
      const { value } = getDisplayWeight(top, customSetUnitType === "kg");
      if (value > heaviest) heaviest = value;
    }
    return heaviest > 0 ? heaviest : null;
  }, [topLiftsByTypeAndReps, liftType, customSetUnitType]);

  const openCustomSetDraft = useCallback(() => {
    if (!canAddSets) return;
    setCustomDraftSeed((prev) => prev + 1);
    setCustomDraftConfig({
      unitType: customSetUnitType,
      notes: getAutoTimestampNotes(),
    });
  }, [canAddSets, customSetUnitType]);

  const handleSuggestedAddSet = useCallback(
    async (setFields) => {
      if (!canAddSets) return;
      setCustomDraftConfig(null);
      await onAddSet(setFields);
    },
    [canAddSets, onAddSet],
  );

  const handleCustomDraftCommit = useCallback(
    async (setFields) => {
      if (!canAddSets) return;
      setCustomDraftConfig(null);
      await onAddSet(setFields);
    },
    [canAddSets, onAddSet],
  );

  // Read warmup settings from localStorage (shared with warmup calculator page)
  const storedBarType =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.WARMUPS_BAR_TYPE, {
      initializeWithValue: false,
    }) ?? null;
  const storedPlatePreference =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.WARMUPS_PLATE_PREFERENCE, {
      initializeWithValue: false,
    }) ?? "blue";
  const defaultBarWeight = getDefaultBarbellWeight({
    isMetric,
    sex,
    storedBarType,
  });

  const inSessionCoachState = useMemo(
    () =>
      getLiftBlockCoachingState({
        dashboardStage,
        isMetric,
        lastRealSet,
        liftType,
        parsedData,
        realSets,
        sessionDate,
        sex,
        standards,
        storedBarType,
        storedPlatePreference,
        topLiftsByTypeAndReps,
        topLiftsByTypeAndRepsLast12Months,
      }),
    [
      dashboardStage,
      isMetric,
      lastRealSet,
      liftType,
      parsedData,
      realSets,
      sessionDate,
      sex,
      standards,
      storedBarType,
      storedPlatePreference,
      topLiftsByTypeAndReps,
      topLiftsByTypeAndRepsLast12Months,
    ],
  );

  // Find the set index with the heaviest e1RM for the strength badge
  const canShowStrength =
    (isOwnData(dataSource) || dataSource === "demo") && hasBioData;
  const { bestE1rmIndex, bestE1rmValue } = useMemo(() => {
    if (!canShowStrength) return { bestE1rmIndex: -1, bestE1rmValue: 0 };
    let bestIdx = -1;
    let bestVal = 0;
    optimisticSetsForStrength.forEach((s, i) => {
      const reps = s.reps ?? 0;
      const weight = s.weight ?? 0;
      if (reps > 0 && weight > 0) {
        const e1rm = estimateE1RM(reps, weight, e1rmFormula);
        if (e1rm > bestVal) {
          bestVal = e1rm;
          bestIdx = i;
        }
      }
    });
    return { bestE1rmIndex: bestIdx, bestE1rmValue: bestVal };
  }, [optimisticSetsForStrength, canShowStrength, e1rmFormula]);

  const prMeta = useMemo(() => {
    return sets.map((s) => {
      const effectiveSet = getEffectiveSetForRanking(
        s,
        optimisticFieldsByKey[getSetIdentityKey(s)],
      );
      const rankingMeta = getOptimisticRankingMeta({
        set: effectiveSet,
        sets,
        optimisticFieldsByKey,
        isMetric,
        topLiftsByTypeAndReps,
        topLiftsByTypeAndRepsLast12Months,
      });
      if (
        s._pending ||
        !effectiveSet.reps ||
        !isValidLiftWeight(liftType, effectiveSet.weight)
      ) {
        return {
          status: null,
          message: null,
          scope: null,
          badges: [],
          celebration: {
            tier: "none",
            score: CELEBRATION_TIERS.none,
            reason: null,
          },
          celebrationKey: null,
        };
      }

      const active = rankingMeta?.best ?? null;
      const rankingBadges = getLogRankingBadges({
        rankingMeta,
        trainingAgeYears,
      }).map((badge) => ({
        ...badge,
        detail: getPrBadgeDetail({
          badge,
          set: s,
          effectiveSet,
          lane: (badge.scope === "yearly"
            ? topLiftsByTypeAndRepsLast12Months
            : topLiftsByTypeAndReps)?.[liftType]?.[effectiveSet.reps - 1],
          isMetric,
        }),
      }));
      const primaryBadge = rankingBadges[0] ?? active;
      const celebration = getCelebrationTier({
        rankingMeta,
        reps: effectiveSet.reps,
        trainingAgeYears,
      });
      const celebrationKey =
        celebration.tier !== "none"
          ? [
              s.rowIndex ??
                s._tempId ??
                `${liftType}-${effectiveSet.reps}-${effectiveSet.weight}`,
              celebration.tier,
              primaryBadge?.scope ?? "lifetime",
              primaryBadge?.rank ?? "na",
            ].join(":")
          : null;

      if (s.isHistoricalPR) {
        return {
          status: primaryBadge?.scope ?? "lifetime",
          message: primaryBadge?.message ?? null,
          scope: primaryBadge?.scope ?? "lifetime",
          badges: rankingBadges,
          celebration,
          celebrationKey,
        };
      }

      if (primaryBadge) {
        return {
          status: primaryBadge.scope,
          message: primaryBadge.message,
          scope: primaryBadge.scope,
          badges: rankingBadges,
          celebration,
          celebrationKey,
        };
      }
      return {
        status: null,
        message: null,
        scope: null,
        badges: [],
        celebration,
        celebrationKey,
      };
    });
  }, [
    sets,
    liftType,
    isMetric,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    trainingAgeYears,
    optimisticFieldsByKey,
  ]);

  const liftSessionHistory = useMemo(
    () => getLiftSessionHistory(parsedData, liftType, sessionDate),
    [parsedData, liftType, sessionDate],
  );

  // A #1 PR already says it beat last time, so a single progression only
  // speaks up for the quieter wins. A streak is news a PR badge cannot carry,
  // so it shows either way.
  const progressionBadges = useMemo(() => {
    const badges = getProgressionBadges({
      sets: optimisticSetsForStrength,
      history: liftSessionHistory,
      sessionDate,
      liftType,
    });
    return badges.map((badge, index) =>
      badge &&
      badge.streak < 2 &&
      prMeta[index]?.badges?.some((pr) => pr.rank === 0)
        ? null
        : badge,
    );
  }, [
    optimisticSetsForStrength,
    liftSessionHistory,
    sessionDate,
    liftType,
    prMeta,
  ]);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (activeCelebrationTimerRef.current)
        clearTimeout(activeCelebrationTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const currentKeys = new Map(
      sets.map((set, index) => [
        set.rowIndex ?? set._tempId ?? `pending-${index}`,
        prMeta[index]?.celebrationKey ?? null,
      ]),
    );

    if (initialCelebrationPassRef.current || isPastSession) {
      initialCelebrationPassRef.current = false;
      previousCelebrationKeysRef.current = currentKeys;
      return;
    }

    const newlyQualified = sets
      .map((set, index) => {
        const rowKey = set.rowIndex ?? set._tempId ?? `pending-${index}`;
        const meta = prMeta[index];
        const previousKey = previousCelebrationKeysRef.current.get(rowKey);

        if (!meta?.celebrationKey || meta.celebrationKey === previousKey) {
          return null;
        }

        return {
          rowKey,
          celebration: meta.celebration,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.celebration.score - a.celebration.score);

    previousCelebrationKeysRef.current = currentKeys;

    if (!newlyQualified.length) return;

    const winner = newlyQualified[0];
    setActiveCelebrationKey(winner.rowKey);
    if (activeCelebrationTimerRef.current)
      clearTimeout(activeCelebrationTimerRef.current);
    activeCelebrationTimerRef.current = setTimeout(() => {
      setActiveCelebrationKey(null);
    }, 2200);

    if (prefersReducedMotion) return;

    fireSetCelebrationConfetti(winner.celebration.tier, liftBlockRef.current);

    if (winner.celebration.tier === "confettiLargeShake") {
      setIsCelebrationShaking(true);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => {
        setIsCelebrationShaking(false);
      }, 600);
    }
  }, [sets, prMeta, isPastSession, prefersReducedMotion]);

  const shouldShowTonnage = useMemo(() => {
    if (!tonnageStats) return false;
    if (sessionCount >= 10) return true;
    if (!hasBioData || !topLiftsByTypeAndReps?.[liftType]) return false;

    const { strengthRating } = getTopLiftStats(
      topLiftsByTypeAndReps[liftType],
      liftType,
      standards,
      e1rmFormula,
    );

    return (
      strengthRating === "Intermediate" ||
      strengthRating === "Advanced" ||
      strengthRating === "Elite"
    );
  }, [
    tonnageStats,
    sessionCount,
    hasBioData,
    topLiftsByTypeAndReps,
    liftType,
    standards,
    e1rmFormula,
  ]);

  const guideUrl = getLiftDetailUrl(liftType);
  const headerVideoAssist =
    inSessionCoachState?.journeyTechniqueAssist?.videoAssist ?? null;

  return (
    <div
      ref={liftBlockRef}
      // `lift-card` owns the colour wash and border tint so the alphas can differ
      // per theme — see the .lift-card block in globals.css.
      className="lift-card bg-card relative overflow-hidden rounded-xl border"
      style={{
        "--lift-color": liftColor,
        animation: isCelebrationShaking
          ? "log-pr-shake 0.6s ease-in-out"
          : undefined,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 rounded-t-xl dark:h-1.5"
        style={{ backgroundColor: liftColor }}
      />
      {/* Header: the lift's face. Drawing, name and today's top set, the
          last session with a way on to the full guide, and on desktop the
          form-check video to the right. */}
      <div className="flex gap-3 px-4 pt-4 md:gap-6 md:px-5 md:pt-6">
        {artworkSrc && (
          <Link
            href={getLiftDetailUrl(liftType)}
            // On a phone the drawing takes a good share of the row's width
            // and sits centred against the text beside it, however many
            // lines that text wraps to.
            className="flex w-[42%] max-w-48 shrink-0 items-center justify-center self-stretch md:w-auto md:max-w-none md:self-start"
          >
            <Image
              src={artworkSrc}
              alt=""
              // 5:3 like the drawings, so the lifter fills the box.
              width={213}
              height={128}
              // PNG drawings would otherwise go through the optimiser, which
              // costs more bytes than the indexed file (see lift-artwork.js).
              unoptimized
              className="h-auto w-full object-contain md:h-32 md:w-[13.3rem]"
            />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 pb-1">
            <Link
              href={getLiftDetailUrl(liftType)}
              className="text-foreground flex items-center gap-2 text-lg font-semibold hover:underline md:text-2xl"
              style={{ textDecorationColor: liftColor }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: liftColor }}
              />
              {liftType}
            </Link>
            {topSetLabel && (
              <span className="text-muted-foreground text-sm">
                Top set{" "}
                <span className="text-foreground font-semibold tabular-nums">
                  {topSetLabel}
                </span>
              </span>
            )}
          </div>
          <LiftSuggestions
            liftType={liftType}
            sessionDate={sessionDate}
            parsedData={parsedData}
            isMetric={isMetric}
            onNavigateToDate={onNavigateToDate}
          />
          {guideUrl && (
            <Link
              href={guideUrl}
              className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-xs font-medium"
            >
              {`Full ${liftType} progress guide`}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        {headerVideoAssist && (
          <div className="hidden w-60 shrink-0 md:block">
            <LiftVideoThumb videoAssist={headerVideoAssist} />
          </div>
        )}
      </div>

      <LiftTechniqueAssist
        techniqueAssist={inSessionCoachState?.journeyTechniqueAssist}
        videoBesideHeader
      />

      {/* Set rows */}
      <div className="divide-border/40 border-border/40 mx-4 mt-3 divide-y border-t md:mx-5">
        {sets.map((set, idx) => {
          const rowIdentityKey = getSetIdentityKey(set, `pending-${idx}`);
          const effectiveSet = optimisticSetsForStrength[idx] ?? set;
          const shouldPassiveAnimate =
            !prefersReducedMotion && initialPassiveRowKeys.has(rowIdentityKey);
          const passiveDelay = shouldPassiveAnimate
            ? Math.min(
                (initialPassiveRowOrder.get(rowIdentityKey) ?? idx) * 0.06,
                0.3,
              )
            : 0;

          return (
            <SetRow
              key={set._tempId ?? set.rowIndex ?? `pending-${idx}`}
              set={set}
              isMetric={isMetric}
              prMeta={prMeta[idx]}
              celebration={prMeta[idx]?.celebration ?? null}
              isActiveCelebration={
                activeCelebrationKey ===
                (set.rowIndex ?? set._tempId ?? `pending-${idx}`)
              }
              shouldPassiveAnimate={shouldPassiveAnimate}
              passiveDelay={passiveDelay}
              onOptimisticFieldsChange={handleOptimisticFieldsChange}
              onUpdate={
                canEditSets
                  ? (update) =>
                      onUpdateSet(
                        {
                          rowIndex: set.rowIndex,
                          tempId: set._tempId ?? null,
                          set,
                        },
                        update,
                      )
                  : undefined
              }
              onDelete={
                canDeleteSets && !set._pending && set.rowIndex
                  ? () => onDeleteSet(set)
                  : null
              }
              isDeleteDisabled={isStructuralSaving || isDeleteCooldownActive}
              usedSessionUrls={usedSessionUrls}
              onSessionUrlAccepted={onSessionUrlAccepted}
              onSessionUrlReleased={onSessionUrlReleased}
              reserveVideoSlot={hasAnyVideo}
              progressionBadge={progressionBadges[idx] ?? null}
              weightFraction={
                sessionTopWeight > 0
                  ? getDisplayWeight(effectiveSet, isMetric).value /
                    sessionTopWeight
                  : null
              }
              strengthTooltip={
                idx === bestE1rmIndex ? (
                  <StrengthLevelTooltipBody
                    liftType={liftType}
                    e1rmValue={bestE1rmValue}
                    standard={getStrengthStandard({
                      liftType,
                      standards,
                      age,
                      sessionDate,
                      bodyWeight,
                      sex,
                      isMetric,
                    })}
                    isMetric={isMetric}
                    reps={effectiveSet.reps}
                    e1rmFormula={e1rmFormula}
                  />
                ) : null
              }
              strengthBadge={
                idx === bestE1rmIndex ? (
                  <LiftStrengthLevel
                    liftType={liftType}
                    workouts={optimisticSetsForStrength}
                    standards={standards}
                    e1rmFormula={e1rmFormula}
                    sessionDate={sessionDate}
                    age={age}
                    bodyWeight={bodyWeight}
                    sex={sex}
                    isMetric={isMetric}
                    asBadge
                    badgeClassName="h-8 rounded-full px-3 text-xs font-semibold"
                  />
                ) : null
              }
            />
          );
        })}
        {canAddSets && customDraftConfig && (
          <CustomSetDraftRow
            key={`custom-${liftType}-${customDraftSeed}`}
            liftType={liftType}
            unitType={customDraftConfig.unitType}
            defaultWeight={defaultBarWeight}
            defaultNotes={customDraftConfig.notes}
            heaviestWeight={heaviestWeight}
            onCommit={handleCustomDraftCommit}
            onCancel={closeCustomSetDraft}
            disabled={isAddSaving}
          />
        )}
      </div>
      {canShowStrength && bestE1rmValue > 0 && (
        <div className={`mx-4 mt-3`}>
          <StrengthBar
            liftType={liftType}
            e1rmValue={bestE1rmValue}
            standards={standards}
            age={age}
            sessionDate={sessionDate}
            bodyWeight={bodyWeight}
            sex={sex}
            isMetric={isMetric}
          />
        </div>
      )}
      {canShowStrength && bestE1rmValue > 0 && (
        <div className={`mx-4 mt-2`}>
          <LiftPercentileLine
            liftType={liftType}
            e1rmValue={bestE1rmValue}
            age={age}
            bodyWeight={bodyWeight}
            sex={sex}
            isMetric={isMetric}
          />
        </div>
      )}
      {shouldShowTonnage && (
        <div className={`mx-4 mt-3`}>
          <LiftTonnageRow
            liftType={liftType}
            stats={optimisticTonnageStats}
            isMetric={isMetric}
          />
        </div>
      )}

      {/* Add-set buttons — card footer (hidden in preview mode) */}
      {canAddSets && (
        <SmartAddButtons
          inSessionCoachState={inSessionCoachState}
          lastRealSet={lastRealSet}
          liftType={liftType}
          onAddSet={handleSuggestedAddSet}
          onStartCustomSet={openCustomSetDraft}
          showHint={showSuggestionHint}
          isPastSession={isPastSession}
          collapseSuggestions={collapseSuggestions}
          disabled={isAddSaving}
        />
      )}
    </div>
  );
}

// One line of context for a PR badge's tooltip. A #1 names the record it just
// passed; anything below #1 names the record it is chasing.
function getPrBadgeDetail({ badge, set, effectiveSet, lane, isMetric }) {
  if (!Array.isArray(lane) || lane.length === 0) return null;
  const reps = effectiveSet.reps;
  const scopeLabel = badge.scope === "yearly" ? "12-month" : "lifetime";

  // The lane holds the saved version of this set, so skip it by row, by
  // object, or by its exact values when there is no row yet.
  const isThisSet = (entry) =>
    entry === set ||
    (set.rowIndex != null
      ? entry.rowIndex === set.rowIndex
      : entry.date === effectiveSet.date &&
        entry.reps === effectiveSet.reps &&
        entry.weight === effectiveSet.weight &&
        entry.unitType === effectiveSet.unitType);
  const describe = (entry) => {
    const { value, unit } = getDisplayWeight(entry, isMetric);
    const date = new Date(`${entry.date}T00:00:00`).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", year: "numeric" },
    );
    return `${entry.reps}@${value}${unit} on ${date}`;
  };

  const other = lane.find((entry) => !isThisSet(entry));
  if (badge.rank === 0) {
    return other
      ? `New ${scopeLabel} best ${reps}RM. It passes ${describe(other)}.`
      : `Your first ${reps}RM on record. Every one from here builds on it.`;
  }
  return other
    ? `Your ${scopeLabel} best ${reps}RM is ${describe(other)}.`
    : null;
}

function getLogRankingBadges({ rankingMeta, trainingAgeYears }) {
  if (!rankingMeta) return [];

  const { lifetime, yearly, best } = rankingMeta;
  const hasMatureHistory = trainingAgeYears > 2;

  if (hasMatureHistory) {
    return [
      lifetime,
      yearly && (yearly.rank < 3 || !lifetime) ? yearly : null,
    ].filter(Boolean);
  }

  return best ? [best] : [];
}
