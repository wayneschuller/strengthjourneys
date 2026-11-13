/**
 * The bodyweight page: the lifter's weigh-ins over time, strength for their
 * bodyweight, and a simple way to add weigh-ins.
 *
 * Weigh-ins are rows of the lifter's own sheet ("Bodyweight | | 84.2kg |
 * note"), the same rows the log's weigh-in strip writes, sent through the
 * log's sync queue (useLogSheetSync) so they are checked and kept offline
 * exactly like a set. See src/lib/bodyweight.js for the series itself.
 *
 * A lifter with fewer than ten weigh-ins gets the entry form first, since
 * the chart only becomes a story once there are a few points on it. Past
 * that, the chart leads and the form sits below it.
 */
import { useLayoutEffect, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  ClipboardPaste,
  Loader2,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useToast } from "@/hooks/use-toast";
import { formatDateToYmdLocal } from "@/lib/date-utils";
import { getSheetWriteColumns } from "@/lib/import/parsers/strength-journeys-parser";
import { convertWeight, unitTypeFor } from "@/lib/weight-units";
import { useLogSheetSync } from "@/components/log/use-log-sheet-sync";
import { WeighInPasteDialog } from "@/components/log/weigh-in-strip";
import { BodyweightTrendCard } from "@/components/visualizer/bodyweight-trend-card";
import { StartLiftingLogCard } from "@/components/onboarding/instructions-cards";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import {
  PageContainer,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Below this many weigh-ins, adding them is the page's first job.
const FEW_WEIGH_INS = 10;

export default function BodyweightPage() {
  const canonicalURL = "https://www.strengthjourneys.xyz/bodyweight";
  const description =
    "Track your bodyweight beside your lifts. Chart every weigh-in and see your strength for your bodyweight, from your own Google Sheet.";
  return (
    <>
      <NextSeo
        title="Bodyweight Tracker for Lifters"
        description={description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title: "Bodyweight Tracker for Lifters",
          description,
          type: "website",
          site_name: "Strength Journeys",
        }}
      />
      <BodyweightMain />
    </>
  );
}

function BodyweightMain() {
  const { status: authStatus } = useSession();
  const {
    dataSource,
    hasLinkedSheet,
    sheetInfo,
    parsedData,
    parsedDataReadAt,
    sheetLayout,
    bodyweightSeries,
    mutate,
  } = useUserLiftingData();
  const { isMetric, sex } = useAthleteBio();
  const { toast } = useToast();
  const unit = unitTypeFor(isMetric);

  const [todayIso, setTodayIso] = useState(null);
  useIsomorphicLayoutEffect(() => {
    setTodayIso(formatDateToYmdLocal(new Date()));
  }, []);

  const sheetColumns = useMemo(
    () => getSheetWriteColumns(sheetLayout),
    [sheetLayout],
  );
  // The same rule the log uses for which sheet the queue belongs to.
  const syncSsid =
    authStatus === "loading" ||
    dataSource === "loading" ||
    dataSource === "restoring"
      ? undefined
      : authStatus === "authenticated"
        ? (sheetInfo?.ssid ?? null)
        : null;
  const { saveWeighIn, deleteWeighIn, weighInSeries } = useLogSheetSync({
    ssid: syncSsid,
    canWrite: hasLinkedSheet,
    parsedData,
    parsedDataReadAt,
    sheetColumns,
    sessionDate: todayIso ?? "",
    isMetric,
    sex,
    mutate,
    toast,
  });
  const canWrite = hasLinkedSheet && sheetColumns !== null && !!todayIso;

  // The queue's view, not the last read: a weigh-in added here shows at once
  // in the list and the chart, marked as saving until the sheet has it.
  const series = hasLinkedSheet ? weighInSeries : bodyweightSeries;
  const count = series?.length ?? 0;

  // Form first or chart first is settled once, from what the lifter had when
  // the page opened, so adding the tenth weigh-in never moves the form out
  // from under them.
  const [leadWithForm, setLeadWithForm] = useState(null);
  const isReady = hasLinkedSheet && Array.isArray(parsedData);
  // Set while rendering, React's pattern for state taken from props once.
  if (leadWithForm === null && isReady) {
    setLeadWithForm(count < FEW_WEIGH_INS);
  }
  const isEarly = leadWithForm ?? count < FEW_WEIGH_INS;

  const entry = canWrite ? (
    <WeighInEntryCard
      bodyweightSeries={series}
      todayIso={todayIso}
      unit={unit}
      compact={!isEarly}
      onSave={saveWeighIn}
      onDelete={deleteWeighIn}
    />
  ) : null;

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={Scale}>Bodyweight</PageHeaderHeading>
        <PageHeaderDescription>
          Your weigh-ins over time, and your strength for your bodyweight. Each
          weigh-in is a row in your own sheet, beside your lifts.
        </PageHeaderDescription>
      </PageHeader>

      {dataSource === "loading" ||
      dataSource === "restoring" ? null : dataSource === "none" ? (
        <StartLiftingLogCard payoff="Your bodyweight chart" />
      ) : !hasLinkedSheet ? (
        <SignInNotice isAuthenticated={authStatus === "authenticated"} />
      ) : (
        <div className="space-y-5">
          {isEarly && entry}
          {count >= 2 ? (
            <BodyweightTrendCard series={series} />
          ) : (
            <p className="text-muted-foreground px-1 text-sm">
              {count === 1
                ? "One weigh-in so far. Your chart starts with the next one."
                : "Your chart starts once you have two weigh-ins."}
            </p>
          )}
          {!isEarly && entry}
          <p className="text-muted-foreground px-1 text-sm">
            You can also add the day&apos;s weigh-in from the{" "}
            <Link href="/log" className="underline underline-offset-2">
              log
            </Link>
            , right above your lifts.
          </p>
        </div>
      )}
    </PageContainer>
  );
}

/**
 * A date, a weight and a note, added one at a time, with the newest
 * weigh-ins listed beneath for a quick check or a delete. Compact once the
 * lifter has plenty of weigh-ins: then it is one row below the chart.
 */
function WeighInEntryCard({
  bodyweightSeries,
  todayIso,
  unit,
  compact,
  onSave,
  onDelete,
}) {
  const latest = bodyweightSeries?.at(-1) ?? null;
  const [date, setDate] = useState(todayIso);
  const [weight, setWeight] = useState(() =>
    latest ? String(round(convertWeight(latest.kg, "kg", unit))) : "",
  );
  const [notes, setNotes] = useState("");
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  // A beat of "Added" on the button, so the tap is answered at once; the row
  // itself appears in the list straight away and settles once it is saved.
  const [justAdded, setJustAdded] = useState(0);
  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(0), 1400);
    return () => clearTimeout(timer);
  }, [justAdded]);
  const prefersReducedMotion = useReducedMotion();
  const recent = (bodyweightSeries ?? []).slice(-6).reverse();

  const value = Number(String(weight).replace(",", "."));
  const isValid = value > 0 && date && date <= todayIso;

  const add = (event) => {
    event.preventDefault();
    if (!isValid) return;
    onSave({ date, weight: round(value), unitType: unit, notes: notes.trim() });
    setNotes("");
    setJustAdded((previous) => previous + 1);
  };

  return (
    <Card>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <CardTitle className="text-lg">
          {compact ? "Add a weigh-in" : "Add your weigh-ins"}
        </CardTitle>
        {!compact && (
          <CardDescription>
            Add a few from the last weeks or months, from memory, an old
            notebook or another app. Your chart and your strength for your
            bodyweight start from them.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Date</span>
            <Input
              type="date"
              value={date}
              max={todayIso}
              onChange={(event) => setDate(event.target.value)}
              className="h-9 w-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Bodyweight ({unit})</span>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              className="h-9 w-28"
            />
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Note (optional)</span>
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="h-9"
            />
          </label>
          <motion.div
            key={justAdded}
            initial={
              justAdded && !prefersReducedMotion ? { scale: 0.92 } : false
            }
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
          >
            <Button
              type="submit"
              size="sm"
              className="h-9 min-w-[5.5rem]"
              disabled={!isValid}
            >
              {justAdded ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" aria-hidden />
              )}
              {justAdded ? "Added" : "Add"}
            </Button>
          </motion.div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => setIsPasteOpen(true)}
          >
            <ClipboardPaste className="h-4 w-4" aria-hidden />
            Paste a table
          </Button>
        </form>

        {!compact && recent.length > 0 && (
          <ul className="divide-y overflow-hidden rounded-md border text-sm">
            <AnimatePresence initial={false}>
              {recent.map((weighIn) => (
                <motion.li
                  key={weighIn.date}
                  layout={!prefersReducedMotion}
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, height: 0 }
                  }
                  animate={{ opacity: 1, height: "auto" }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, height: 0 }
                  }
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex items-center gap-3 px-3 py-1.5"
                >
                  <span className="tabular-nums">{weighIn.date}</span>
                  <span
                    className={
                      weighIn.pending
                        ? "font-semibold tabular-nums opacity-70"
                        : "font-semibold tabular-nums"
                    }
                  >
                    {round(convertWeight(weighIn.kg, "kg", unit))} {unit}
                  </span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                    {weighIn.pending ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        Saving to your sheet
                      </span>
                    ) : (
                      weighIn.notes
                    )}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    aria-label={`Delete the weigh-in on ${weighIn.date}`}
                    onClick={() => onDelete(weighIn.date)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
      <WeighInPasteDialog
        open={isPasteOpen}
        onOpenChange={setIsPasteOpen}
        bodyweightSeries={bodyweightSeries}
        todayIso={todayIso}
        unit={unit}
        onSave={onSave}
      />
    </Card>
  );
}

function SignInNotice({ isAuthenticated }) {
  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl">
          Your weigh-ins, beside your lifts
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          Log a weigh-in now and then, and see your bodyweight over time and
          your strength for your bodyweight, month by month. It all lives in
          your own Google Sheet.
        </CardDescription>
      </CardHeader>
      {!isAuthenticated && (
        <CardContent>
          <GoogleSignInButton
            size="sm"
            cta="bodyweight_page"
            callbackUrl="/bodyweight"
          >
            Sign in to track your bodyweight
          </GoogleSignInButton>
        </CardContent>
      )}
    </Card>
  );
}

function round(value) {
  return Math.round(Number(value) * 10) / 10;
}
