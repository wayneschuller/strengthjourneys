import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LiftSvg } from "@/components/year-recap/lift-svg";
import {
  ChevronDown,
  ChevronUp,
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
  if (bits.length === 0) {
    return isEnriching
      ? "Analyzing workouts and date range..."
      : "Lifting log detected";
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

function formatPreviewE1RM(preview) {
  if (!preview || typeof preview.e1rm !== "number") return "";
  const roundedE1RM =
    Math.abs(preview.e1rm - Math.round(preview.e1rm)) < 0.05
      ? String(Math.round(preview.e1rm))
      : preview.e1rm.toFixed(1);
  return `~${roundedE1RM}${preview.unitType || ""} e1rm`;
}

function formatPreviewPrimaryValue(preview) {
  const weight = formatPreviewWeight(preview);
  if (!weight || !preview?.reps) return weight;
  return `${weight} × ${preview.reps}`;
}

function formatPreviewSetDetail(preview) {
  if (!preview) return "";
  const date = formatPreviewDate(preview.date);
  if (preview.reps === 1) return date ? `(${date})` : "";
  const e1rm = formatPreviewE1RM(preview);
  if (!e1rm) return date ? `(${date})` : "";
  return `${e1rm}${date ? ` (${date})` : ""}`;
}

function getCandidateUrl(candidate) {
  return typeof candidate?.webViewLink === "string" &&
    candidate.webViewLink.trim()
    ? candidate.webViewLink
    : null;
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
  embedded = false,
}) {
  const importFileRef = useRef(null);
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

  const content = (
    <>
      {!embedded && (
        <CardHeader className="xl:px-10 2xl:px-16">
          <CardTitle className="flex items-center gap-2 text-lg">
            <img
              src={GOOGLE_SHEETS_ICON_URL}
              alt=""
              className="h-5 w-5 shrink-0"
              aria-hidden
            />
            {isSwitchSheet
              ? "Switch your lifting data"
              : "Connect your lifting log"}
          </CardTitle>
          <CardDescription>
            {isSwitchSheet
              ? "Pick the sheet you want to use instead of your current one."
              : "Strength Journeys found Google Sheets in your Drive that look like lifting logs. Choose one to connect, or start fresh with a new sheet."}
          </CardDescription>
          {statusMessage && (
            <div className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
              {isEnriching && <LoaderCircle className="h-4 w-4 animate-spin" />}
              <span>{statusMessage}</span>
            </div>
          )}
        </CardHeader>
      )}
      <CardContent
        className={
          embedded ? "space-y-5 px-0 pt-0 pb-0" : "space-y-5 xl:px-10 2xl:px-16"
        }
      >
        <div className="space-y-3">
          {showImportedPreviewWarning && (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="space-y-3">
                <p>
                  Choosing a sheet here leaves preview mode and forgets the
                  imported file
                  {importedPreviewFileName
                    ? ` (${importedPreviewFileName}).`
                    : "."}
                </p>
                {onMergeImportedPreview && currentSheetInfo?.ssid ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
                      Or merge {importedPreviewEntryCount.toLocaleString()}{" "}
                      imported{" "}
                      {importedPreviewEntryCount === 1 ? "entry" : "entries"}{" "}
                      into your current sheet first.
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
                    Use the preview banner&apos;s save action if you want to
                    merge that import into a sheet instead.
                  </p>
                )}
              </div>
            </div>
          )}
          {statusMessage && embedded && (
            <div className="border-border/60 bg-card/50 text-muted-foreground flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
              {isEnriching && <LoaderCircle className="h-4 w-4 animate-spin" />}
              <span>{statusMessage}</span>
            </div>
          )}
          {primaryCandidate && (
            <>
              <p className="text-foreground/80 text-sm font-semibold">
                {isSwitchSheet ? "Best replacement" : "Recommended for you"}
              </p>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div
                  key={primaryCandidate.id}
                  className="border-primary/20 bg-card/80 rounded-2xl border px-6 py-6 shadow-sm"
                >
                  <div className="max-w-2xl space-y-5">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {getCandidateUrl(primaryCandidate) ? (
                          <a
                            href={getCandidateUrl(primaryCandidate)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-foreground hover:text-primary truncate text-lg font-semibold underline-offset-2 hover:underline"
                          >
                            {primaryCandidate.name}
                          </a>
                        ) : (
                          <p className="text-foreground truncate text-lg font-semibold">
                            {primaryCandidate.name}
                          </p>
                        )}
                        {freshnessLabel && (
                          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">
                            {freshnessLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm font-medium">
                        {isSwitchSheet
                          ? "This looks like the best replacement for your current data source."
                          : "This looks like your main lifting log."}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {formatRecommendedMeta(primaryCandidate, isEnriching)}
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
                              Best sets detected
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {primaryCandidate.bigFourPreview.map(
                                (preview) => (
                                  <div
                                    key={preview.liftType}
                                    className="bg-background/90 flex min-w-[120px] items-center gap-2 rounded-md border border-black/10 px-2.5 py-2"
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
                                ),
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto sm:min-w-56"
                        disabled={
                          isWorking || currentSsid === primaryCandidate.id
                        }
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
                          {isDisconnectingCurrent
                            ? "Disconnecting..."
                            : "Disconnect"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-start justify-center lg:pt-1">
                  <div className="w-full max-w-sm space-y-3">
                    {isSwitchSheet &&
                      currentSheetInfo?.ssid &&
                      !isPrimaryCurrent && (
                        <div className="border-border/70 bg-card/70 rounded-2xl border px-5 py-4">
                          <div className="flex flex-col gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="text-foreground/80 text-sm font-semibold">
                                Current data source
                              </p>
                              {currentSheetInfo?.url ? (
                                <a
                                  href={currentSheetInfo.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-foreground hover:text-primary block truncate text-base font-semibold underline-offset-2 hover:underline"
                                >
                                  {currentSheetInfo.filename ||
                                    "Connected lifting log"}
                                </a>
                              ) : (
                                <p className="text-foreground truncate text-base font-semibold">
                                  {currentSheetInfo.filename ||
                                    "Connected lifting log"}
                                </p>
                              )}
                              <p className="text-muted-foreground text-sm">
                                Disconnect it if you want to remove it without
                                switching to another sheet.
                              </p>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="w-full"
                              disabled={isWorking || isDisconnectingCurrent}
                              onClick={onDisconnectCurrent}
                            >
                              <Unplug className="mr-2 h-4 w-4" />
                              {isDisconnectingCurrent
                                ? "Disconnecting..."
                                : "Disconnect"}
                            </Button>
                          </div>
                        </div>
                      )}
                    <div className="border-primary/20 bg-primary/5 w-full rounded-lg border p-3">
                      <p className="text-foreground text-sm font-semibold">
                        Other options
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {showImportOption
                          ? "Browse Google Drive, import a data file, or start fresh."
                          : "Browse Google Drive or start fresh."}
                      </p>
                      <div className="mt-3 flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
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
                              size="sm"
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
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={onCreateBlank}
                          disabled={isWorking}
                        >
                          <PlusSquare className="mr-2 h-4 w-4" />
                          Start fresh
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {!primaryCandidate && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div />
              <div className="flex items-start justify-center lg:pt-1">
                <div className="w-full max-w-sm space-y-3">
                  {isSwitchSheet &&
                    currentSheetInfo?.ssid &&
                    !isPrimaryCurrent && (
                      <div className="border-border/70 bg-card/70 rounded-2xl border px-5 py-4">
                        <div className="flex flex-col gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="text-foreground/80 text-sm font-semibold">
                              Current data source
                            </p>
                            {currentSheetInfo?.url ? (
                              <a
                                href={currentSheetInfo.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-foreground hover:text-primary block truncate text-base font-semibold underline-offset-2 hover:underline"
                              >
                                {currentSheetInfo.filename ||
                                  "Connected lifting log"}
                              </a>
                            ) : (
                              <p className="text-foreground truncate text-base font-semibold">
                                {currentSheetInfo.filename ||
                                  "Connected lifting log"}
                              </p>
                            )}
                            <p className="text-muted-foreground text-sm">
                              Disconnect it if you want to remove it without
                              switching to another sheet.
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            disabled={isWorking || isDisconnectingCurrent}
                            onClick={onDisconnectCurrent}
                          >
                            <Unplug className="mr-2 h-4 w-4" />
                            {isDisconnectingCurrent
                              ? "Disconnecting..."
                              : "Disconnect"}
                          </Button>
                        </div>
                      </div>
                    )}
                  <div className="border-primary/20 bg-primary/5 w-full rounded-lg border p-3">
                    <p className="text-foreground text-sm font-semibold">
                      Other options
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {showImportOption
                        ? "Browse Google Drive, import a data file, or start fresh."
                        : "Browse Google Drive or start fresh."}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={isWorking || !onImportFile}
                          onClick={() => importFileRef.current?.click()}
                        >
                          <FileUp className="mr-2 h-4 w-4" />
                          Import data file
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={onCreateBlank}
                        disabled={isWorking}
                      >
                        <PlusSquare className="mr-2 h-4 w-4" />
                        Start fresh
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {otherCandidates.length > 0 && (
            <>
              <div className="bg-card/70 rounded-xl border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => setShowOtherSheets((prev) => !prev)}
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
                        className="bg-background/80 flex flex-col gap-3 rounded-xl border px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="mb-1 flex min-w-0 items-center gap-2">
                            <img
                              src={GOOGLE_SHEETS_ICON_URL}
                              alt=""
                              className="h-4 w-4 shrink-0"
                              aria-hidden
                            />
                            {getCandidateUrl(candidate) ? (
                              <a
                                href={getCandidateUrl(candidate)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-foreground hover:text-primary text-sm leading-snug font-semibold break-words underline-offset-2 hover:underline"
                              >
                                {candidate.name}
                              </a>
                            ) : (
                              <p className="text-foreground text-sm leading-snug font-semibold break-words">
                                {candidate.name}
                              </p>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {formatCandidateMeta(candidate, isEnriching)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
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
            </>
          )}
        </div>
      </CardContent>
    </>
  );

  if (embedded) return content;

  return (
    <Card className="border-primary/20 bg-background/95 mb-4 xl:mx-auto xl:w-full xl:max-w-6xl 2xl:max-w-[1280px]">
      {content}
    </Card>
  );
}
