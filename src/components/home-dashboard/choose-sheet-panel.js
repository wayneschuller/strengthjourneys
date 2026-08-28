/**
 * Sheet chooser shown inside the setup dialog once Drive has been asked to spot us.
 * Single column on purpose: recommendation first, escape hatches second, the long
 * tail of other sheets folded away. Keep sheet selection separate from "open in
 * Google Sheets" so titles are not mistaken for primary CTAs.
 */
import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LiftSvg } from "@/components/year-recap/lift-svg";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileUp,
  FolderOpen,
  Link2,
  LoaderCircle,
  PlusSquare,
  Unplug,
} from "lucide-react";

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

/**
 * Secondary escape hatches: browse Drive by hand, or rack a brand new sheet.
 * Rendered full width under the recommendation so "start fresh" reads as a real
 * choice rather than the third button in a side rail.
 */
function OtherOptionsRow({
  hasPrimary,
  isSwitchSheet,
  openPicker,
  isWorking,
  showImportOption,
  onImportFile,
  onCreateBlank,
}) {
  const importFileRef = useRef(null);
  const buttonCount = showImportOption ? 3 : 2;

  return (
    <div className="border-border/60 bg-muted/30 rounded-xl border px-4 py-4">
      <p className="text-foreground text-sm font-semibold">
        {hasPrimary ? "Not the right bar?" : "Let's load a bar for you"}
      </p>
      <p className="text-muted-foreground mt-0.5 text-sm">
        {hasPrimary
          ? "Pick a different sheet from your Drive, or start with an empty one."
          : "Choose a sheet from your Drive, or start with an empty one."}
      </p>
      <div
        className={cn(
          "mt-3 grid gap-2",
          buttonCount === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        <Button
          variant="outline"
          className="w-full"
          disabled={!openPicker || isWorking}
          onClick={() => {
            if (openPicker) handleOpenFilePicker(openPicker);
          }}
        >
          <FolderOpen className="mr-2 h-4 w-4" />
          Browse Google Drive
        </Button>
        {showImportOption && (
          <>
            <Button
              variant="outline"
              className="w-full"
              disabled={isWorking || !onImportFile}
              onClick={() => importFileRef.current?.click()}
            >
              <FileUp className="mr-2 h-4 w-4" />
              Import data file
            </Button>
            <input
              ref={importFileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onImportFile) onImportFile(file);
                e.target.value = "";
              }}
            />
          </>
        )}
        <Button
          // With nothing detected there is no hero CTA, so this becomes the
          // primary path rather than a fallback.
          variant={hasPrimary ? "outline" : "default"}
          className="w-full"
          onClick={onCreateBlank}
          disabled={isWorking}
        >
          <PlusSquare className="mr-2 h-4 w-4" />
          {isSwitchSheet ? "Start a fresh sheet" : "Start fresh"}
        </Button>
      </div>
    </div>
  );
}

/** Compact reminder of what is connected today, shown only when switching. */
function CurrentSourceStrip({
  currentSheetInfo,
  isWorking,
  isDisconnectingCurrent,
  onDisconnectCurrent,
}) {
  return (
    <div className="border-border/70 bg-card/70 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Currently connected
        </p>
        <SheetNameWithExternalLink
          name={currentSheetInfo.filename || "Connected lifting log"}
          url={currentSheetInfo?.url || null}
          textClassName="text-foreground truncate text-sm font-semibold"
          linkClassName="text-muted-foreground hover:text-primary shrink-0 transition-colors"
          iconClassName="h-3.5 w-3.5"
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
        disabled={isWorking || isDisconnectingCurrent}
        onClick={onDisconnectCurrent}
      >
        <Unplug className="mr-2 h-4 w-4" />
        {isDisconnectingCurrent ? "Disconnecting..." : "Disconnect"}
      </Button>
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
  onImportFile,
  showImportOption = true,
}) {
  const isSwitchSheet = intent === "switch_sheet";
  const primaryCandidate =
    candidates.find((candidate) => candidate.id === recommendedId) ||
    candidates[0] ||
    null;
  const otherCandidates = candidates.filter(
    (candidate) => candidate.id !== primaryCandidate?.id,
  );
  const isPrimaryCurrent =
    primaryCandidate?.id && currentSsid === primaryCandidate.id;
  const [showOtherSheets, setShowOtherSheets] = useState(false);
  const freshnessLabel = formatRelativeFreshness(
    primaryCandidate?.modifiedByMeTime || primaryCandidate?.modifiedTime,
  );
  const recommendedMeta = primaryCandidate
    ? formatRecommendedMeta(primaryCandidate, isEnriching)
    : "";
  const showCurrentSourceStrip =
    isSwitchSheet && currentSheetInfo?.ssid && !isPrimaryCurrent;

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

      {showCurrentSourceStrip && (
        <CurrentSourceStrip
          currentSheetInfo={currentSheetInfo}
          isWorking={isWorking}
          isDisconnectingCurrent={isDisconnectingCurrent}
          onDisconnectCurrent={onDisconnectCurrent}
        />
      )}

      {primaryCandidate && (
        <div className="border-primary/25 bg-card/80 space-y-5 rounded-2xl border px-5 py-5 shadow-sm sm:px-6">
          <div className="min-w-0 space-y-2">
            {candidates.length > 1 && (
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {isSwitchSheet ? "Best replacement" : "Recommended for you"}
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
              {isSwitchSheet
                ? "This looks like the best replacement for your current data source."
                : "This looks like your main lifting log."}{" "}
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
            {isPrimaryCurrent && (
              <p className="text-primary text-xs font-semibold tracking-wide uppercase">
                Currently connected
              </p>
            )}
            {Array.isArray(primaryCandidate.bigFourPreview) &&
              primaryCandidate.bigFourPreview.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Best actual sets detected
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {primaryCandidate.bigFourPreview.map((preview) => (
                      <div
                        key={preview.liftType}
                        className="bg-background/90 border-border/70 flex items-center gap-2 rounded-md border px-2.5 py-2"
                      >
                        <LiftSvg
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
              )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              size="lg"
              className="w-full sm:w-auto sm:min-w-64"
              disabled={isWorking || currentSsid === primaryCandidate.id}
              onClick={() => onChooseSheet(primaryCandidate.id)}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {currentSsid === primaryCandidate.id
                ? "Currently connected"
                : isSwitchSheet
                  ? "Switch to this sheet"
                  : "Connect this lifting log"}
            </Button>
            {isPrimaryCurrent && (
              <Button
                variant="destructive"
                size="lg"
                className="w-full sm:w-auto"
                disabled={isWorking || isDisconnectingCurrent}
                onClick={onDisconnectCurrent}
              >
                <Unplug className="mr-2 h-4 w-4" />
                {isDisconnectingCurrent ? "Disconnecting..." : "Disconnect"}
              </Button>
            )}
          </div>
        </div>
      )}

      <OtherOptionsRow
        hasPrimary={Boolean(primaryCandidate)}
        isSwitchSheet={isSwitchSheet}
        openPicker={openPicker}
        isWorking={isWorking}
        showImportOption={showImportOption}
        onImportFile={onImportFile}
        onCreateBlank={onCreateBlank}
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
                  ? "Other accessible sheets"
                  : "Other detected sheets"}
              </p>
              <p className="text-muted-foreground text-sm">
                {otherCandidates.length} more option
                {otherCandidates.length === 1 ? "" : "s"}
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
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isWorking || currentSsid === candidate.id}
                    onClick={() => onChooseSheet(candidate.id)}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {currentSsid === candidate.id
                      ? "Currently connected"
                      : isSwitchSheet
                        ? "Switch to this sheet"
                        : "Use this"}
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
