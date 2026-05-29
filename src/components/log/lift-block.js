/**
 * Per-lift session block for the log page.
 * Owns lift-level suggestions, strength context, PR celebration, and set rows.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { useReducedMotion } from "motion/react";
import { useReadLocalStorage } from "usehooks-ts";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { getTopLiftStats, useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { hexToRgba } from "@/lib/color-tools";
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
import { BIG_FOUR_LIFT_META } from "@/lib/big-four-lifts";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { isValidLiftWeight } from "@/lib/data-sources/parser-utilities";
import { StrengthBar } from "@/components/strength-level/strength-bar";
import { LiftPercentileLine } from "@/components/strength-level/lift-percentile-line";
import {
  LiftStrengthLevel,
  LiftTonnageRow,
} from "@/components/home-dashboard/session-exercise-block";
import { getLiftDetailUrl } from "@/components/lift-type-indicator";
import {
  LiftSuggestions,
  LiftTechniqueAssist,
  SmartAddButtons,
} from "@/components/log/add-controls";
import { CustomSetDraftRow } from "@/components/log/custom-set-draft-row";
import { SetRow } from "@/components/log/set-row";
import { getLiftBlockCoachingState } from "@/components/log/lift-block-coaching-state";
import { getAutoTimestampNotes } from "@/components/log/sheet-snapshot-utils";

const BIG_FOUR = BIG_FOUR_LIFT_META.map(({ liftType, iconSrc }) => ({
  name: liftType,
  icon: iconSrc,
}));

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
  isDeleteCooldownActive = false,
  onUpdateSet,
  onDeleteSet,
  onAddSet,
  onNavigateToDate,
  previewMode = false,
  usedSessionUrls,
  onSessionUrlAccepted,
}) {
  const { hasUserData, isDemoMode, isImportedData } = useUserLiftingData();
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
  const bigFourEntry = BIG_FOUR.find((b) => b.name === liftType);
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
  const canEditSets = !previewMode && typeof onUpdateSet === "function";
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
      if (!e.isGoal) dates.add(e.date);
    }
    return dates.size <= 20;
  }, [parsedData]);

  const closeCustomSetDraft = useCallback(() => {
    setCustomDraftConfig(null);
  }, []);

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

  const openCustomSetDraft = useCallback(() => {
    if (!canAddSets) return;
    setCustomDraftSeed((prev) => prev + 1);
    setCustomDraftConfig({
      unitType: lastRealSet?.unitType ?? (isMetric ? "kg" : "lb"),
      notes: getAutoTimestampNotes(),
    });
  }, [canAddSets, isMetric, lastRealSet?.unitType]);

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
    }) ?? "standard";
  const storedPlatePreference =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.WARMUPS_PLATE_PREFERENCE, {
      initializeWithValue: false,
    }) ?? "blue";

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
      standards,
      storedBarType,
      storedPlatePreference,
      topLiftsByTypeAndReps,
      topLiftsByTypeAndRepsLast12Months,
    ],
  );

  // Find the set index with the heaviest e1RM for the strength badge
  const canShowStrength =
    (hasUserData || isDemoMode || isImportedData) && hasBioData;
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
          celebration: {
            tier: "none",
            score: CELEBRATION_TIERS.none,
            reason: null,
          },
          celebrationKey: null,
        };
      }

      const active = rankingMeta?.best ?? null;
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
              active?.scope ?? "lifetime",
              active?.rank ?? "na",
            ].join(":")
          : null;

      if (s.isHistoricalPR) {
        return {
          status: "lifetime",
          message: active?.message ?? null,
          scope: active?.scope ?? "lifetime",
          celebration,
          celebrationKey,
        };
      }

      if (active) {
        return {
          status: active.scope,
          message: active.message,
          scope: active.scope,
          celebration,
          celebrationKey,
        };
      }
      return {
        status: null,
        message: null,
        scope: null,
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

  const desktopIconInsetClass = "md:pl-28 lg:pl-32";
  const desktopIconOffsetClass = "md:ml-28 lg:ml-32";

  return (
    <div
      ref={liftBlockRef}
      className="bg-card relative overflow-hidden rounded-xl border"
      style={{
        backgroundImage: `linear-gradient(135deg, ${hexToRgba(liftColor, 0.12)} 0%, ${hexToRgba(liftColor, 0.06)} 18%, rgba(255, 255, 255, 0) 42%)`,
        animation: isCelebrationShaking
          ? "log-pr-shake 0.6s ease-in-out"
          : undefined,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
        style={{ backgroundColor: liftColor }}
      />
      {/* Desktop: large icon in left gutter */}
      {bigFourEntry && (
        <div className="absolute top-4 left-4 hidden md:block">
          <Link href={getLiftDetailUrl(liftType)}>
            <Image
              src={bigFourEntry.icon}
              alt=""
              width={104}
              height={104}
              className="opacity-80 transition-opacity hover:opacity-100"
            />
          </Link>
        </div>
      )}

      {/* Header: icon + lift name + last session */}
      <div className={`flex gap-3 px-4 pt-4 ${desktopIconInsetClass}`}>
        {bigFourEntry && (
          <Link
            href={getLiftDetailUrl(liftType)}
            className="shrink-0 self-start md:hidden"
          >
            <Image src={bigFourEntry.icon} alt="" width={52} height={52} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="pb-1">
            <Link
              href={getLiftDetailUrl(liftType)}
              className="text-foreground flex items-center gap-2 text-base font-semibold hover:underline"
              style={{ textDecorationColor: liftColor }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: liftColor }}
              />
              {liftType}
            </Link>
          </div>
          <LiftSuggestions
            liftType={liftType}
            sessionDate={sessionDate}
            parsedData={parsedData}
            isMetric={isMetric}
            onNavigateToDate={onNavigateToDate}
          />
        </div>
      </div>

      <LiftTechniqueAssist
        techniqueAssist={inSessionCoachState?.journeyTechniqueAssist}
        hasBigFourIcon
      />

      {/* Set rows — border-t inset on desktop to clear the icon gutter */}
      <div
        className={`divide-border/40 border-border/40 mx-4 mt-1 divide-y border-t ${desktopIconOffsetClass}`}
      >
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
            defaultNotes={customDraftConfig.notes}
            onCommit={handleCustomDraftCommit}
            onCancel={closeCustomSetDraft}
            disabled={isStructuralSaving}
          />
        )}
      </div>
      {canShowStrength && bestE1rmValue > 0 && (
        <div className={`mx-4 mt-3 ${desktopIconOffsetClass}`}>
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
        <div className={`mx-4 mt-2 ${desktopIconOffsetClass}`}>
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
        <div className={`mx-4 mt-3 ${desktopIconOffsetClass}`}>
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
          hasBigFourIcon
          isPastSession={isPastSession}
          disabled={isStructuralSaving}
        />
      )}
    </div>
  );
}
