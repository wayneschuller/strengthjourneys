import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LiftSvg } from "@/components/year-recap/lift-svg";
import { FolderOpen, Link2, LoaderCircle, PlusSquare } from "lucide-react";

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
    return isEnriching ? "Analyzing workouts and date range..." : "Lifting sheet detected";
  }
  return bits.join(" · ");
}

function formatRecommendedMeta(candidate, isEnriching = false) {
  const bits = [];
  const isSampled = Boolean(candidate?.metadataSampled);
  const startYear = parseInt(formatYearLabel(candidate?.dateRangeStart) || "", 10);
  const endYear = parseInt(formatYearLabel(candidate?.dateRangeEnd) || "", 10);
  if (typeof candidate?.approxSessions === "number") {
    bits.push(
      isSampled
        ? `${candidate.approxSessions.toLocaleString()}+ workouts`
        : `${candidate.approxSessions.toLocaleString()} workouts`,
    );
  }
  if (Number.isFinite(startYear) && Number.isFinite(endYear) && endYear >= startYear) {
    if (isSampled) {
      const spanYears = endYear - startYear + 1;
      bits.push(`${spanYears}+ years data`);
    } else {
      bits.push(`${startYear}-${endYear}`);
    }
  }
  if (bits.length === 0) {
    return isEnriching ? "Analyzing workouts and date range..." : "Lifting log detected";
  }
  return bits.join(" • ");
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

function formatPreviewSetDetail(preview) {
  if (!preview) return "";
  const weight = formatPreviewWeight(preview);
  const date = formatPreviewDate(preview.date);
  if (!weight) return "";
  return `${preview.reps}@${weight}${date ? ` (${date})` : ""}`;
}

export function ChooseSheetPanel({
  intent = "recovery",
  candidates,
  currentSsid = null,
  recommendedId = null,
  openPicker,
  isWorking,
  isEnriching = false,
  statusMessage = "",
  onChooseSheet,
  onCreateBlank,
}) {
  const isSwitchSheet = intent === "switch_sheet";
  const primaryCandidate =
    candidates.find((candidate) => candidate.id === recommendedId) || candidates[0] || null;
  const otherCandidates = candidates.filter((candidate) => candidate.id !== primaryCandidate?.id);

  return (
    <Card className="mb-4 border-primary/20 bg-background/95 xl:mx-auto xl:w-full xl:max-w-6xl 2xl:max-w-[1280px]">
      <CardHeader className="xl:px-10 2xl:px-16">
        <CardTitle className="flex items-center gap-2 text-lg">
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="h-5 w-5 shrink-0"
            aria-hidden
          />
          {isSwitchSheet ? "Choose a lifting log" : "Connect your lifting log"}
        </CardTitle>
        <CardDescription>
          {isSwitchSheet
            ? "Strength Journeys found sheets you can access. Pick the one you want to connect, or start fresh with a new sheet."
            : "Strength Journeys found Google Sheets in your Drive that look like lifting logs. Choose one to connect, or start fresh with a new sheet."}
        </CardDescription>
        {statusMessage && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            {isEnriching && <LoaderCircle className="h-4 w-4 animate-spin" />}
            <span>{statusMessage}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-5 xl:px-10 2xl:px-16">
        <div className="space-y-3">
          {primaryCandidate && (
            <>
              <p className="text-sm font-semibold text-foreground">
                {isSwitchSheet ? "Recommended sheet" : "Your lifting log"}
              </p>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div
                  key={primaryCandidate.id}
                  className="rounded-xl border border-black/10 bg-card/40 px-6 py-6"
                >
                  <div className="max-w-2xl space-y-5">
                    <div className="min-w-0 space-y-2">
                      <p className="truncate text-base font-semibold text-foreground">
                        {primaryCandidate.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatRecommendedMeta(primaryCandidate, isEnriching)}
                      </p>
                      {currentSsid === primaryCandidate.id && (
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                          Currently connected
                        </p>
                      )}
                      {Array.isArray(primaryCandidate.bigFourPreview) &&
                        primaryCandidate.bigFourPreview.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Best lifts detected
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {primaryCandidate.bigFourPreview.map((preview) => (
                                <div
                                  key={preview.liftType}
                                  className="flex min-w-[120px] items-center gap-2 rounded-md border border-black/10 bg-background/90 px-2.5 py-2"
                                >
                                  <LiftSvg
                                    liftType={preview.liftType}
                                    size="sm"
                                    animate={false}
                                    className="h-8 w-8"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium leading-tight text-muted-foreground">
                                      {getPreviewLiftLabel(preview.liftType)}
                                    </p>
                                    <p className="text-base font-semibold leading-tight text-foreground">
                                      {formatPreviewWeight(preview)}
                                    </p>
                                    <p className="truncate text-[10px] leading-tight text-muted-foreground">
                                      {formatPreviewSetDetail(preview)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                    <Button
                      size="lg"
                      className="w-full sm:w-auto sm:min-w-56"
                      disabled={isWorking || currentSsid === primaryCandidate.id}
                      onClick={() => onChooseSheet(primaryCandidate.id)}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {currentSsid === primaryCandidate.id
                        ? "Already connected"
                        : isSwitchSheet
                          ? "Switch to this sheet"
                          : "Connect this lifting log"}
                    </Button>
                  </div>
                </div>
                <div className="flex items-start justify-center lg:pt-1">
                  <div className="w-full max-w-sm rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-sm font-semibold text-foreground">
                      Don&apos;t see the sheet you want?
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Browse Google Drive to grant Strength Journeys access to another sheet, or start fresh with a clean lifting log.
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
            </>
          )}
          {otherCandidates.length > 0 && (
            <>
              <p className="pt-2 text-sm font-semibold text-muted-foreground">
                {isSwitchSheet ? "Other accessible sheets" : "Other sheets we detected"}
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {otherCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="mb-1 flex min-w-0 items-center gap-2">
                        <img
                          src={GOOGLE_SHEETS_ICON_URL}
                          alt=""
                          className="h-4 w-4 shrink-0"
                          aria-hidden
                        />
                        <p className="truncate text-sm font-semibold text-foreground">
                          {candidate.name}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatCandidateMeta(candidate, isEnriching)}
                      </p>
                      {currentSsid === candidate.id && (
                        <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-primary">
                          Currently connected
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isWorking || currentSsid === candidate.id}
                      onClick={() => onChooseSheet(candidate.id)}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {currentSsid === candidate.id
                        ? "Connected"
                        : isSwitchSheet
                          ? "Switch"
                          : "Connect"}
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
