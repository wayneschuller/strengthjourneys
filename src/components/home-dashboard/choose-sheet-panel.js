/**
 * Sheet chooser shown inside the setup dialog once Drive has been asked to spot us.
 * Single column on purpose, in two arrangements:
 *   setting up  our recommendation, then the other ways in, then the long tail
 *               of other sheets folded away
 *   switching   the sheet connected now (never a "recommendation": it is
 *               already theirs), then the other ways in, then every other
 *               sheet laid open, since choosing one is why they came
 * "Import from another app" sits with the other ways in because a lifter who
 * wants a Hevy or Strong export in their log looks for it here.
 * Keep sheet selection separate from "open in Google Sheets" so titles are not
 * mistaken for primary CTAs.
 */
import { handleOpenFilePicker } from "@/lib/sheet/handle-open-picker";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/sheet/google-sheets-icon";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LiftArtwork } from "@/components/lift-artwork";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileUp,
  Link2,
  LoaderCircle,
  Unplug,
} from "lucide-react";

/**
 * Google Drive mark, inlined the same way the sign-in button inlines the "G".
 * Pairs with the Sheets icon so both escape hatches name the product they open.
 */
function GoogleDriveIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 87.3 78"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        fill="#0066da"
        d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z"
      />
      <path
        fill="#00ac47"
        d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44C.4 49.9 0 51.45 0 53h27.5z"
      />
      <path
        fill="#ea4335"
        d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.798l5.852 11.5z"
      />
      <path
        fill="#00832d"
        d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z"
      />
      <path
        fill="#2684fc"
        d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
      />
      <path
        fill="#ffba00"
        d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
      />
    </svg>
  );
}

function formatYearLabel(isoDate) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getFullYear());
}

function formatCandidateMeta(candidate, isEnriching = false) {
  const isSampled = Boolean(candidate?.metadataSampled);
  const bits = [];

  if (typeof candidate?.approxRows === "number") {
    bits.push(
      isSampled
        ? `${candidate.approxRows.toLocaleString()}+ rows`
        : `${candidate.approxRows.toLocaleString()} rows`,
    );
  }
  if (typeof candidate?.approxSessions === "number") {
    bits.push(
      isSampled
        ? `${candidate.approxSessions.toLocaleString()}+ workouts`
        : `${candidate.approxSessions.toLocaleString()} workouts`,
    );
  }
  const start = formatYearLabel(candidate?.dateRangeStart);
  const end = formatYearLabel(candidate?.dateRangeEnd);
  if (start && end) bits.push(`${start}-${end}`);

  if (bits.length === 0) {
    return isEnriching
      ? "Analyzing workouts and date range..."
      : "Lifting sheet detected";
  }
  return bits.join(" · ");
}

function formatRecommendedMeta(candidate, isEnriching = false) {
  const bits = [];
  const isSampled = Boolean(candidate?.metadataSampled);
  const startYear = parseInt(
    formatYearLabel(candidate?.dateRangeStart) || "",
    10,
  );
  const endYear = parseInt(formatYearLabel(candidate?.dateRangeEnd) || "", 10);
  if (typeof candidate?.approxSessions === "number") {
    bits.push(
      isSampled
        ? `${candidate.approxSessions.toLocaleString()}+ workouts`
        : `${candidate.approxSessions.toLocaleString()} workouts`,
    );
  }
  if (
    Number.isFinite(startYear) &&
    Number.isFinite(endYear) &&
    endYear >= startYear
  ) {
    if (isSampled) {
      const spanYears = endYear - startYear + 1;
      bits.push(`${spanYears}+ years data`);
    } else {
      bits.push(`${startYear}-${endYear}`);
    }
  }
  // Returns "" rather than a filler phrase: this string is appended to a
  // sentence that already says we think this is the lifter's log.
  if (bits.length === 0) {
    return isEnriching ? "Analyzing workouts and date range..." : "";
  }
  return bits.join(" • ");
}

function formatRelativeFreshness(isoDate) {
  if (!isoDate) return null;
  const timestamp = new Date(isoDate).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const diffDays = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Updated today";
  if (diffDays === 1) return "Updated yesterday";
  if (diffDays < 7) return `Updated ${diffDays} days ago`;
  return null;
}

function formatPreviewDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getPreviewLiftLabel(liftType) {
  const liftLabelMap = {
    "Back Squat": "Squat",
    "Bench Press": "Bench",
    Deadlift: "Deadlift",
    "Strict Press": "Press",
  };
  return liftLabelMap[liftType] || liftType;
}

function formatPreviewWeight(preview) {
  if (!preview || typeof preview.weight !== "number") return "";
  const roundedWeight =
    Math.abs(preview.weight - Math.round(preview.weight)) < 0.05
      ? String(Math.round(preview.weight))
      : preview.weight.toFixed(1);
  return `${roundedWeight}${preview.unitType || ""}`;
}

function formatPreviewPrimaryValue(preview) {
  const weight = formatPreviewWeight(preview);
  if (!weight || !preview?.reps) return weight;
  return `${weight} × ${preview.reps}`;
}

function formatPreviewSetDetail(preview) {
  if (!preview) return "";
  const date = formatPreviewDate(preview.date);
  return date ? `(${date})` : "";
}

function getCandidateUrl(candidate) {
  return typeof candidate?.webViewLink === "string" &&
    candidate.webViewLink.trim()
    ? candidate.webViewLink
    : null;
}

function SheetNameWithExternalLink({
  name,
  url,
  textClassName,
  linkClassName,
  iconClassName = "h-4 w-4",
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <p className={textClassName}>{name}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${name} in Google Sheets`}
          className={`${linkClassName} mt-0.5`}
        >
          <ExternalLink className={iconClassName} />
        </a>
      ) : null}
    </div>
  );
}

export function ChooseSheetPanel({
  intent = "recovery",
  candidates,
  currentSsid = null,
  currentSheetInfo = null,
  recommendedId = null,
  showImportedPreviewWarning = false,
  importedPreviewEntryCount = 0,
  importedPreviewFileName = "",
  openPicker,
  isWorking,
  isDisconnectingCurrent = false,
  isEnriching = false,
  statusMessage = "",
  onMergeImportedPreview,
  onChooseSheet,
  onCreateBlank,
  onDisconnectCurrent,
  onImportFromApp,
}) {
  const isSwitchSheet = intent === "switch_sheet";
  const hasCurrentSheet = Boolean(currentSheetInfo?.ssid);
  // Switching never recommends: the top card is the sheet connected now, and
  // every other sheet is a plain choice below it.
  const primaryCandidate = isSwitchSheet
    ? null
    : candidates.find((candidate) => candidate.id === recommendedId) ||
      candidates[0] ||
      null;
  // Drive may not list the connected sheet among the candidates; the card
  // then shows its name alone.
  const currentCandidate = hasCurrentSheet
    ? candidates.find((candidate) => candidate.id === currentSsid) || null
    : null;
  // Our analysis still has a verdict when switching, and the lifter should
  // hear it: either the sheet they are on is the most complete log we found,
  // or another one is and it leads the list with a badge. Held back until the
  // analysis has finished, so the verdict never changes in front of them.
  const bestMatchId = isSwitchSheet && !isEnriching ? recommendedId : null;
  const isCurrentBestMatch =
    Boolean(bestMatchId) && bestMatchId === currentSsid;
  const otherCandidates = candidates
    .filter(
      (candidate) =>
        candidate.id !== primaryCandidate?.id &&
        !(isSwitchSheet && candidate.id === currentSsid),
    )
    .sort(
      (a, b) => Number(b.id === bestMatchId) - Number(a.id === bestMatchId),
    );
  // Folded away while setting up, laid open while switching.
  const [showOtherSheets, setShowOtherSheets] = useState(isSwitchSheet);
  const freshnessLabel = formatRelativeFreshness(
    primaryCandidate?.modifiedByMeTime || primaryCandidate?.modifiedTime,
  );
  const recommendedMeta = primaryCandidate
    ? formatRecommendedMeta(primaryCandidate, isEnriching)
    : "";
  const chooseLabel = !isSwitchSheet
    ? "Use this"
    : hasCurrentSheet
      ? "Switch to this sheet"
      : "Connect this sheet";

  return (
    <div className="space-y-4">
      {/* Only a live progress line earns space here; the dialog title already
          tells the lifter to pick a sheet. */}
      {isEnriching && statusMessage && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          <span>{statusMessage}</span>
        </div>
      )}

      {showImportedPreviewWarning && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="space-y-3">
            <p>
              Choosing a sheet here leaves preview mode and forgets the imported
              file
              {importedPreviewFileName ? ` (${importedPreviewFileName}).` : "."}
            </p>
            {onMergeImportedPreview && currentSheetInfo?.ssid ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
                  Or merge {importedPreviewEntryCount.toLocaleString()} imported{" "}
                  {importedPreviewEntryCount === 1 ? "entry" : "entries"} into
                  your current sheet first.
                </p>
                <Button
                  size="sm"
                  className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
                  disabled={isWorking}
                  onClick={onMergeImportedPreview}
                >
                  Merge into current sheet
                </Button>
              </div>
            ) : (
              <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
                Use the preview banner&apos;s save action if you want to merge
                that import into a sheet instead.
              </p>
            )}
          </div>
        </div>
      )}

      {isSwitchSheet && hasCurrentSheet && (
        <ConnectedSheetCard
          currentSheetInfo={currentSheetInfo}
          candidate={currentCandidate}
          isBestMatch={isCurrentBestMatch}
          otherSheetCount={otherCandidates.length}
          isEnriching={isEnriching}
          isWorking={isWorking}
          isDisconnectingCurrent={isDisconnectingCurrent}
          onDisconnectCurrent={onDisconnectCurrent}
        />
      )}

      {primaryCandidate && (
        <div className="border-primary/25 bg-card/80 space-y-5 rounded-2xl border px-5 py-5 shadow-sm sm:px-6">
          <div className="min-w-0 space-y-2">
            {candidates.length > 1 && (
              <p className="text-primary text-sm font-medium">
                Recommended for you
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <img
                src={GOOGLE_SHEETS_ICON_URL}
                alt=""
                className="h-5 w-5 shrink-0"
                aria-hidden
              />
              <SheetNameWithExternalLink
                name={primaryCandidate.name}
                url={getCandidateUrl(primaryCandidate)}
                textClassName="text-foreground truncate text-lg font-semibold"
                linkClassName="text-muted-foreground hover:text-primary shrink-0 transition-colors"
              />
              {freshnessLabel && (
                <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">
                  {freshnessLabel}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              This looks like your main lifting log.{" "}
              {recommendedMeta ? (
                <span className="text-foreground/80 font-medium">
                  {recommendedMeta}
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {typeof primaryCandidate?.approxSessions === "number" &&
                primaryCandidate.approxSessions >= 20 && (
                  <span className="border-border bg-background text-foreground/80 rounded-full border px-2.5 py-1 text-xs font-medium">
                    Most complete history
                  </span>
                )}
              {typeof primaryCandidate?.approxRows === "number" &&
                primaryCandidate.approxRows >= 250 && (
                  <span className="border-border bg-background text-foreground/80 rounded-full border px-2.5 py-1 text-xs font-medium">
                    High-confidence match
                  </span>
                )}
            </div>
            <BestSetsGrid previews={primaryCandidate.bigFourPreview} />
          </div>
          <Button
            size="lg"
            className="w-full sm:w-auto sm:min-w-64"
            disabled={isWorking || currentSsid === primaryCandidate.id}
            onClick={() => onChooseSheet(primaryCandidate.id)}
          >
            <Link2 className="mr-2 h-4 w-4" />
            {currentSsid === primaryCandidate.id
              ? "Connected"
              : "Connect this lifting log"}
          </Button>
        </div>
      )}

      <OtherOptionsRow
        hasPrimary={Boolean(primaryCandidate)}
        isSwitchSheet={isSwitchSheet}
        hasCurrentSheet={hasCurrentSheet}
        openPicker={openPicker}
        isWorking={isWorking}
        onCreateBlank={onCreateBlank}
        // A preview is already open: its banner is where that import goes.
        onImportFromApp={showImportedPreviewWarning ? null : onImportFromApp}
      />

      {otherCandidates.length > 0 && (
        <div className="bg-card/70 rounded-xl border">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left"
            onClick={() => setShowOtherSheets((prev) => !prev)}
            aria-expanded={showOtherSheets}
          >
            <div>
              <p className="text-foreground text-sm font-semibold">
                {isSwitchSheet
                  ? hasCurrentSheet
                    ? "Switch to another sheet"
                    : "Connect a sheet"
                  : "Other detected sheets"}
              </p>
              <p className="text-muted-foreground text-sm">
                {isSwitchSheet
                  ? `${otherCandidates.length} lifting ${otherCandidates.length === 1 ? "log" : "logs"} in your Google Drive`
                  : `${otherCandidates.length} more option${otherCandidates.length === 1 ? "" : "s"}`}
              </p>
            </div>
            {showOtherSheets ? (
              <ChevronUp className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            )}
          </button>
          {showOtherSheets && (
            <div className="grid grid-cols-1 gap-3 border-t px-4 py-4 md:grid-cols-2">
              {otherCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="bg-background/80 flex flex-col justify-between gap-3 rounded-xl border px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex min-w-0 items-center gap-2">
                      <img
                        src={GOOGLE_SHEETS_ICON_URL}
                        alt=""
                        className="h-4 w-4 shrink-0"
                        aria-hidden
                      />
                      <SheetNameWithExternalLink
                        name={candidate.name}
                        url={getCandidateUrl(candidate)}
                        textClassName="text-foreground text-sm leading-snug font-semibold break-words"
                        linkClassName="text-muted-foreground hover:text-primary shrink-0 transition-colors"
                      />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {formatCandidateMeta(candidate, isEnriching)}
                    </p>
                    {candidate.id === bestMatchId && (
                      <p className="bg-primary/10 text-primary mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium">
                        Most complete history we found
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isWorking || currentSsid === candidate.id}
                    onClick={() => onChooseSheet(candidate.id)}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {currentSsid === candidate.id ? "Connected" : chooseLabel}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The sheet connected now, shown first when switching. It states a fact, so it
 * carries no call to action: the one control is a quiet Disconnect, kept small
 * so the way out of a 12-year log never looks like the main button.
 */
function ConnectedSheetCard({
  currentSheetInfo,
  candidate,
  isBestMatch,
  otherSheetCount,
  isEnriching,
  isWorking,
  isDisconnectingCurrent,
  onDisconnectCurrent,
}) {
  const meta = candidate ? formatRecommendedMeta(candidate, isEnriching) : "";

  return (
    <div className="border-primary/25 bg-card/80 space-y-4 rounded-2xl border px-5 py-5 shadow-sm sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-primary inline-flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Connected now
          </p>
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={GOOGLE_SHEETS_ICON_URL}
              alt=""
              className="h-5 w-5 shrink-0"
              aria-hidden
            />
            <SheetNameWithExternalLink
              name={
                candidate?.name ||
                currentSheetInfo.filename ||
                "Your lifting log"
              }
              url={getCandidateUrl(candidate) || currentSheetInfo.url || null}
              textClassName="text-foreground truncate text-lg font-semibold"
              linkClassName="text-muted-foreground hover:text-primary shrink-0 transition-colors"
            />
          </div>
          {meta ? (
            <p className="text-muted-foreground text-sm">{meta}</p>
          ) : null}
          {isBestMatch && (
            <p className="text-foreground text-sm font-medium">
              {otherSheetCount > 0
                ? `We checked ${otherSheetCount + 1} lifting logs in your Google Drive. This one has the most complete history, so you are on the right sheet.`
                : "This is the lifting log we found in your Google Drive, so you are on the right sheet."}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -ml-3 shrink-0 self-start sm:ml-0"
          disabled={isWorking || isDisconnectingCurrent}
          onClick={onDisconnectCurrent}
        >
          <Unplug className="mr-2 h-4 w-4" />
          {isDisconnectingCurrent ? "Disconnecting..." : "Disconnect"}
        </Button>
      </div>
      <BestSetsGrid previews={candidate?.bigFourPreview} />
    </div>
  );
}

/** The heaviest real set found for each big-four lift: proof it is their log. */
function BestSetsGrid({ previews }) {
  if (!Array.isArray(previews) || previews.length === 0) return null;

  return (
    <div className="space-y-2 pt-1">
      <p className="text-muted-foreground text-sm">Best sets in this sheet</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {previews.map((preview) => (
          <div
            key={preview.liftType}
            className="bg-background/90 border-border/70 flex items-center gap-2 rounded-md border px-2.5 py-2"
          >
            <LiftArtwork
              liftType={preview.liftType}
              size="sm"
              animate={false}
              className="h-8 w-8"
            />
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] leading-tight font-medium">
                {getPreviewLiftLabel(preview.liftType)}
              </p>
              <p className="text-foreground text-base leading-tight font-semibold">
                {formatPreviewPrimaryValue(preview)}
              </p>
              <p className="text-muted-foreground truncate text-[10px] leading-tight">
                {formatPreviewSetDetail(preview)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The other ways in: bring a history over from another app, browse Drive by
 * hand, or rack a brand new sheet. Rendered full width so each reads as a real
 * choice rather than a button in a side rail.
 */
function OtherOptionsRow({
  hasPrimary,
  isSwitchSheet,
  hasCurrentSheet,
  openPicker,
  isWorking,
  onCreateBlank,
  onImportFromApp,
}) {
  const title = isSwitchSheet
    ? hasCurrentSheet
      ? "Add to it, or change it"
      : "Ways to get started"
    : hasPrimary
      ? "Not the right sheet?"
      : "Ways to get started";
  const description =
    isSwitchSheet && hasCurrentSheet
      ? onImportFromApp
        ? "Bring your history over from another app and merge it into this sheet, pick a different sheet from your Drive, or start an empty one."
        : "Pick a different sheet from your Drive, or start an empty one."
      : onImportFromApp
        ? "Bring your history over from another app, choose a sheet from your Drive, or start with an empty one."
        : "Choose a sheet from your Drive, or start with an empty one.";

  return (
    <div className="border-border/60 bg-muted/30 rounded-xl border px-4 py-4">
      <p className="text-foreground text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
      <div
        className={cn(
          "mt-3 grid gap-2",
          onImportFromApp ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {onImportFromApp && (
          <Button
            variant="outline"
            className="w-full"
            disabled={isWorking}
            onClick={onImportFromApp}
          >
            <FileUp className="mr-2 h-4 w-4" />
            Import from another app
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full"
          disabled={!openPicker || isWorking}
          onClick={() => {
            if (openPicker) handleOpenFilePicker(openPicker);
          }}
        >
          <GoogleDriveIcon className="mr-2 h-4 w-4" />
          Browse Google Drive
        </Button>
        <Button
          // With nothing detected there is no hero CTA, so this becomes the
          // primary path rather than a fallback.
          variant={hasPrimary || isSwitchSheet ? "outline" : "default"}
          className="w-full"
          onClick={onCreateBlank}
          disabled={isWorking}
        >
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="mr-2 h-4 w-4"
            aria-hidden
          />
          {isSwitchSheet ? "Start a fresh sheet" : "Start fresh"}
        </Button>
      </div>
    </div>
  );
}
