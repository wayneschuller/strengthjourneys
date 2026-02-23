
import { useRef, useMemo, useState, useEffect } from "react";
import { motion, animate } from "motion/react";
import { pickQuirkyPhrase, SESSIONS_PHRASES, CONSISTENCY_PHRASES } from "../phrases";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { getGradeAndColor } from "@/lib/consistency-grades";
import { CircularProgressWithLetter } from "@/components/analyzer/circular-progress-with-letter";
import { Calendar } from "lucide-react";

const MERGED_PHRASES = [...SESSIONS_PHRASES, ...CONSISTENCY_PHRASES];

/**
 * Recap slide showing total training sessions, consistency grade, best weekly streak, and a year-over-year comparison.
 * Animates a circular progress indicator when the slide becomes active.
 * @param {Object} props
 * @param {number|string} props.year - The recap year to compute session stats for.
 * @param {boolean} props.isDemo - Whether the card is being shown in demo mode.
 * @param {boolean} [props.isActive] - Controls entrance animations; should be true only when this carousel slide is visible.
 */
export function SessionsCard({ year, isDemo, isActive = true }) {
  const phraseRef = useRef(null);
  const phrase = pickQuirkyPhrase(MERGED_PHRASES, phraseRef, `sessions-${year}`);

  const { parsedData } = useUserLiftingData();
  const stats = useMemo(
    () => computeSessionStatsForYear(parsedData, year),
    [parsedData, year],
  );

  const { count, prevYearCount, bestStreak, consistencyGrade, consistencyPercentage } = stats;

  const [animatedProgress, setAnimatedProgress] = useState(0);
  useEffect(() => {
    if (!isActive || !consistencyGrade) {
      setAnimatedProgress(0);
      return;
    }
    const controls = animate(0, consistencyPercentage, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => setAnimatedProgress(v),
    });
    return () => controls.stop();
  }, [isActive, consistencyPercentage, consistencyGrade]);

  const showPrevYearComparison = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const isDecember = now.getMonth() === 11;
    const yearNum = parseInt(year, 10);
    return yearNum < currentYear || (yearNum === currentYear && isDecember);
  }, [year]);

  const isCurrentYear = Number(year) === new Date().getFullYear();
  const comparisonYearWord = isCurrentYear ? "last" : "previous";

  const comparisonText = useMemo(() => {
    if (!showPrevYearComparison || prevYearCount == null || prevYearCount === 0) return null;
    const diff = count - prevYearCount;
    if (diff > 0) return `Up ${diff} from ${comparisonYearWord} year`;
    if (diff < 0) return `${Math.abs(diff)} fewer than ${comparisonYearWord} year`;
    return `Same as ${comparisonYearWord} year`;
  }, [showPrevYearComparison, count, prevYearCount, comparisonYearWord]);

  const grade = consistencyGrade?.grade ?? null;
  const showGrade = grade && grade !== ".";
  const periodLabel = isCurrentYear ? "in the last year" : `in ${year}`;

  return (
    <div className="flex flex-col items-center justify-center gap-0 text-center">
      {/* Top: Calendar + sessions */}
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={{ type: "spring", stiffness: 240, damping: 20 }}
        >
          <Calendar className="mb-4 h-12 w-12 text-chart-1" />
        </motion.div>
        <motion.p
          className="text-5xl font-bold tabular-nums text-foreground md:text-6xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 220, damping: 22, delay: isActive ? 0.05 : 0 }}
        >
          {count}
        </motion.p>
        <motion.p
          className="mt-2 text-xl font-semibold text-chart-2"
          initial={{ opacity: 0, x: -16 }}
          animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
          transition={{ type: "spring", stiffness: 180, damping: 18, delay: isActive ? 0.12 : 0 }}
        >
          training sessions
        </motion.p>
        <motion.p
          className="mt-0.5 text-base text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: isActive ? 0.15 : 0 }}
        >
          {periodLabel}
        </motion.p>
        {showGrade && (
          <motion.div
            className="mt-2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: isActive ? 0.18 : 0 }}
          >
            <CircularProgressWithLetter
              progress={Math.round(animatedProgress)}
              size="lg"
              gradeOverride={isActive ? consistencyPercentage : undefined}
            />
          </motion.div>
        )}
        {showGrade && (
          <motion.p
            className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={isActive ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: isActive ? 0.3 : 0 }}
          >
            Yearly consistency
          </motion.p>
        )}
        {comparisonText && (
          <motion.p
            className="mt-1 text-sm text-muted-foreground"
            initial={{ opacity: 0, y: 8 }}
            animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ delay: isActive ? 0.32 : 0 }}
          >
            {comparisonText}
          </motion.p>
        )}
      </div>

      {/* Bottom: Streak */}
      {bestStreak > 0 && (
        <motion.div
          className="mt-6 flex flex-col items-center"
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: isActive ? 0.3 : 0 }}
        >
          <p className="text-base text-muted-foreground">Best streak:</p>
          <p className="text-2xl font-bold tabular-nums text-foreground md:text-3xl">
            {bestStreak} week{bestStreak !== 1 ? "s" : ""}
          </p>
        </motion.div>
      )}

      <motion.p
        className="mt-3 text-sm italic text-muted-foreground"
        initial={{ opacity: 0, y: 12 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ delay: isActive ? 0.38 : 0 }}
      >
        {phrase}
      </motion.p>
    </div>
  );
}

// --- Supporting functions ---

function getWeekKeyFromDateStr(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  const daysBack = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysInMonth(y, month1Based) {
  if (month1Based === 2) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month1Based)) return 30;
  return 31;
}

function addDaysFromStr(dateStr, n) {
  let y = parseInt(dateStr.slice(0, 4), 10);
  let m = parseInt(dateStr.slice(5, 7), 10);
  let d = parseInt(dateStr.slice(8, 10), 10);
  for (let i = 0; i < n; i++) {
    const maxD = daysInMonth(y, m);
    d++;
    if (d > maxD) {
      d = 1;
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function computeBestStreakForYear(sessionDates, year) {
  if (!sessionDates.length) return 0;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const weekMap = new Map();
  const dateToWeekKey = new Map();
  sessionDates.forEach((dateStr) => {
    if (dateStr < yearStart || dateStr > yearEnd) return;
    let weekKey = dateToWeekKey.get(dateStr);
    if (weekKey === undefined) {
      weekKey = getWeekKeyFromDateStr(dateStr);
      dateToWeekKey.set(dateStr, weekKey);
    }
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Set());
    weekMap.get(weekKey).add(dateStr);
  });
  const weekSessionCount = new Map();
  weekMap.forEach((dates, weekKey) => {
    weekSessionCount.set(weekKey, dates.size);
  });
  const firstMonday = getWeekKeyFromDateStr(yearStart);
  const lastMonday = getWeekKeyFromDateStr(yearEnd);
  let bestStreak = 0;
  let tempStreak = 0;
  let weekKey = firstMonday;
  while (weekKey <= lastMonday) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= 3) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
    weekKey = addDaysFromStr(weekKey, 7);
  }
  return bestStreak;
}

function computeSessionStatsForYear(parsedData, year) {
  const empty = {
    count: 0,
    prevYearCount: null,
    bestStreak: 0,
    consistencyGrade: null,
    consistencyPercentage: 0,
  };
  if (!parsedData || !year) return empty;

  const prevYear = String(parseInt(year, 10) - 1);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const prevYearStart = `${prevYear}-01-01`;
  const prevYearEnd = `${prevYear}-12-31`;

  const sessionDates = new Set();
  const prevYearDates = new Set();

  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    if (entry.date >= yearStart && entry.date <= yearEnd) {
      sessionDates.add(entry.date);
    }
    if (entry.date >= prevYearStart && entry.date <= prevYearEnd) {
      prevYearDates.add(entry.date);
    }
  });

  const sortedDates = Array.from(sessionDates).sort();
  const count = sessionDates.size;
  const bestStreak = computeBestStreakForYear(sortedDates, year);
  const expectedSessions = Math.round((365 / 7) * 3);
  const consistencyPercentage = Math.min(
    100,
    Math.round((count / expectedSessions) * 100),
  );
  const consistencyGrade = getGradeAndColor(consistencyPercentage);
  const prevCount = prevYearDates.size;

  return {
    count,
    prevYearCount: prevCount > 0 ? prevCount : null,
    bestStreak,
    consistencyGrade,
    consistencyPercentage,
  };
}
