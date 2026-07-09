/**
 * Lifting-data share controls for the AI Lifting Assistant.
 * Collapses under a status summary on mobile so the chat column stays clean;
 * stays fully open on desktop in the sticky settings rail.
 */
import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";
import { useSession } from "next-auth/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { cn } from "@/lib/utils";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";

/**
 * Card that manages which lifting data categories are shared with the AI assistant.
 * Handles auth states (unauthenticated, no sheet connected, sheet loaded) and renders the appropriate Google sign-in, sheet picker, or data-sharing checkboxes.
 * @param {Object} props
 * @param {Object} props.selectedOptions - Object of boolean flags controlling which data categories are shared (all, records, trainingLoad, frequency, consistency, sessionData).
 * @param {Function} props.setSelectedOptions - State setter for selectedOptions; receives the full updated options object.
 */
export function LiftingDataCard({ selectedOptions, setSelectedOptions }) {
  const { parsedData, isLoading, sheetInfo, hasUserData, isImportedData } =
    useUserLiftingData();
  const { status: authStatus } = useSession();
  const isDesktop = useMediaQuery("(min-width: 1024px)", {
    initializeWithValue: false,
  });
  // Mobile starts collapsed so chat stays primary; desktop is always expanded.
  const [mobileOpen, setMobileOpen] = useState(false);
  const open = Boolean(isDesktop) || mobileOpen;

  const isUnauthenticated = authStatus === "unauthenticated" && !isImportedData;
  const isAuthenticated = authStatus === "authenticated";
  const hasSheet = isAuthenticated && !!sheetInfo?.ssid;
  const hasPersonalData = hasUserData && parsedData && parsedData.length > 0;

  const handleSelectAll = () => {
    const allChecked = !selectedOptions.all;
    setSelectedOptions({
      all: allChecked,
      records: allChecked,
      trainingLoad: allChecked,
      frequency: allChecked,
      consistency: allChecked,
      sessionData: allChecked,
    });
  };

  const handleOptionChange = (key) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
      all: false,
    }));
  };

  const statusDescription = (() => {
    if (hasPersonalData) return "Data successfully loaded and available.";
    if (hasUserData && isLoading) return "Loading your data...";
    if (hasUserData && !isLoading) return "No lifting data found";
    if (isUnauthenticated)
      return "Sign in to share your lifting data with the AI";
    if (isAuthenticated && !hasSheet)
      return "Set up your Google Sheet to get started";
    return "Connect data to personalise coaching";
  })();

  const sharedCategoryCount = [
    selectedOptions.records,
    selectedOptions.frequency,
    selectedOptions.trainingLoad,
    selectedOptions.consistency,
    selectedOptions.sessionData,
  ].filter(Boolean).length;

  const mobileSummary = (() => {
    if (!hasPersonalData) return statusDescription;
    if (selectedOptions.all || sharedCategoryCount === 5)
      return "Sharing all training categories";
    if (sharedCategoryCount === 0) return "No categories shared";
    return `Sharing ${sharedCategoryCount} categor${sharedCategoryCount === 1 ? "y" : "ies"}`;
  })();

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        if (!isDesktop) setMobileOpen(next);
      }}
    >
      <Card>
        <CardHeader className="space-y-0 p-0">
          <CollapsibleTrigger
            asChild
            disabled={isDesktop}
            className="lg:pointer-events-none"
          >
            <button
              type="button"
              className="hover:bg-muted/40 flex w-full items-start justify-between gap-3 rounded-t-lg p-6 pb-3 text-left transition-colors lg:hover:bg-transparent"
              aria-label={
                mobileOpen
                  ? "Collapse lifting data settings"
                  : "Expand lifting data settings"
              }
            >
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl lg:text-2xl">
                  Talk To Your Lifting Data
                </CardTitle>
                <CardDescription className="mt-1">
                  {statusDescription}
                </CardDescription>
                <p className="text-muted-foreground mt-2 text-xs lg:hidden">
                  {mobileSummary}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "text-muted-foreground mt-1 h-4 w-4 shrink-0 transition-transform duration-200 lg:hidden",
                  open && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* State 1: Unauthenticated (and no CSV import) - prompt to sign in */}
            {!hasUserData && isUnauthenticated && (
              <div className="flex flex-col items-start gap-3">
                <p className="text-muted-foreground w-64 text-pretty text-sm">
                  Sign in with Google to connect your lifting spreadsheet and
                  share your data with the AI assistant.
                </p>
                <GoogleSignInButton size="sm" cta="ai_assistant">
                  Sign in with Google
                </GoogleSignInButton>
              </div>
            )}

            {/* State 2: Authenticated but no sheet connected */}
            {!hasUserData && isAuthenticated && !hasSheet && (
              <div className="flex flex-col items-start gap-3">
                <p className="text-muted-foreground w-64 text-pretty text-sm">
                  Set up your Google Sheet to share your personal lifting data
                  with the AI.
                </p>
                <Button
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => {
                    openSheetSetupDialog("bootstrap");
                  }}
                >
                  <img
                    src={GOOGLE_SHEETS_ICON_URL}
                    alt=""
                    className="h-4 w-4 shrink-0"
                    aria-hidden
                  />
                  Set Up Google Sheet
                </Button>
              </div>
            )}

            {/* State 3: User has data (GSheet or CSV import) — show sharing checkboxes */}
            {hasUserData && (
              <div
                className={cn(
                  !hasPersonalData && "pointer-events-none opacity-50",
                )}
              >
                <div className="text-muted-foreground mb-2">
                  Select the lifting info to share with the AI:
                </div>
                <div className="space-y-2">
                  <div className="group flex items-center gap-2">
                    <Checkbox
                      id="select-all-checkbox"
                      checked={selectedOptions.all}
                      onCheckedChange={handleSelectAll}
                      disabled={!hasPersonalData}
                      className="group-hover:border-blue-500"
                    />
                    <Label
                      htmlFor="select-all-checkbox"
                      className="cursor-pointer group-hover:underline"
                    >
                      {selectedOptions.all ? "Unshare All" : "Share All"}
                    </Label>
                  </div>

                  <Separator />
                  <div className="group flex items-center gap-2">
                    <Checkbox
                      id="records-checkbox"
                      checked={selectedOptions.records}
                      onCheckedChange={() => handleOptionChange("records")}
                      disabled={!hasPersonalData}
                      className="group-hover:border-blue-500"
                    />
                    <Label
                      htmlFor="records-checkbox"
                      className={cn(
                        "cursor-pointer hover:underline",
                        !selectedOptions.records && "text-muted-foreground/50",
                      )}
                    >
                      Personal records, lifetime and yearly
                    </Label>
                  </div>
                  <div className="group flex items-center gap-2">
                    <Checkbox
                      id="frequency-checkbox"
                      checked={selectedOptions.frequency}
                      onCheckedChange={() => handleOptionChange("frequency")}
                      disabled={!hasPersonalData}
                      className="group-hover:border-blue-500"
                    />
                    <Label
                      htmlFor="frequency-checkbox"
                      className={cn(
                        "cursor-pointer hover:underline",
                        !selectedOptions.frequency &&
                          "text-muted-foreground/50",
                      )}
                    >
                      Lift frequency and timeline metadata
                    </Label>
                  </div>
                  <div className="group flex items-center gap-2">
                    <Checkbox
                      id="training-load-checkbox"
                      checked={selectedOptions.trainingLoad}
                      onCheckedChange={() => handleOptionChange("trainingLoad")}
                      disabled={!hasPersonalData}
                      className="group-hover:border-blue-500"
                    />
                    <Label
                      htmlFor="training-load-checkbox"
                      className={cn(
                        "cursor-pointer hover:underline",
                        !selectedOptions.trainingLoad &&
                          "text-muted-foreground/50",
                      )}
                    >
                      Training load and tonnage trends
                    </Label>
                  </div>
                  <div className="group flex items-center gap-2">
                    <Checkbox
                      id="consistency-checkbox"
                      checked={selectedOptions.consistency}
                      onCheckedChange={() => handleOptionChange("consistency")}
                      disabled={!hasPersonalData}
                      className="group-hover:border-blue-500"
                    />
                    <Label
                      htmlFor="consistency-checkbox"
                      className={cn(
                        "cursor-pointer hover:underline",
                        !selectedOptions.consistency &&
                          "text-muted-foreground/50",
                      )}
                    >
                      Consistency ratings
                    </Label>
                  </div>
                  <div className="group flex items-center gap-2">
                    <Checkbox
                      id="session-data-checkbox"
                      checked={selectedOptions.sessionData}
                      onCheckedChange={() => handleOptionChange("sessionData")}
                      disabled={!hasPersonalData}
                      className="group-hover:border-blue-500"
                    />
                    <Label
                      htmlFor="session-data-checkbox"
                      className={cn(
                        "cursor-pointer hover:underline",
                        !selectedOptions.sessionData &&
                          "text-muted-foreground/50",
                      )}
                    >
                      Detailed data from recent sessions
                    </Label>
                  </div>
                </div>
              </div>
            )}

            <div className="text-muted-foreground mt-5 text-sm">
              <p className="w-64 text-pretty">
                Your lifting data stays in your browser. Nothing is streamed to
                our servers—only summary points are shared with the AI.{" "}
              </p>
              <p>
                For more information read our{" "}
                <Link
                  href="/privacy-policy.html"
                  className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
                >
                  Privacy Policy
                </Link>
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
