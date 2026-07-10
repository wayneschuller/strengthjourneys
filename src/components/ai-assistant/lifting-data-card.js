import Link from "next/link";
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
 * @param {boolean} props.embedded - Whether to render as a section inside the merged personalization panel.
 */
export function LiftingDataCard({
  selectedOptions,
  setSelectedOptions,
  embedded = false,
}) {
  const { parsedData, isLoading, sheetInfo, hasUserData, isImportedData } = useUserLiftingData();
  const { status: authStatus } = useSession();

  const isUnauthenticated = authStatus === "unauthenticated" && !isImportedData;
  const isAuthenticated = authStatus === "authenticated";
  const hasSheet = isAuthenticated && !!sheetInfo?.ssid;
  const hasPersonalData =
    hasUserData && parsedData && parsedData.length > 0;

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

  const content = (
    <>
      {embedded && (
        <div className="mb-5">
          <h3 className="text-lg font-semibold">Training data</h3>
          <p className="text-muted-foreground text-sm">
            Choose which training summaries the assistant can use.
          </p>
        </div>
      )}
      <CardDescription className={cn("mb-5", !embedded && "hidden")}>
        {hasPersonalData && "Data successfully loaded and available."}
        {!hasPersonalData && hasUserData && isLoading && "Loading your data..."}
        {!hasPersonalData && hasUserData && !isLoading && "No lifting data found"}
        {!hasUserData && isUnauthenticated &&
          "Sign in to share your lifting data with the AI"}
        {!hasUserData && isAuthenticated && !hasSheet &&
          "Set up your Google Sheet to get started"}
      </CardDescription>
      {/* State 1: Unauthenticated (and no CSV import) - prompt to sign in */}
      {!hasUserData && isUnauthenticated && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground max-w-sm text-pretty text-sm">
            Sign in with Google to connect your lifting spreadsheet and share
            your data with the AI assistant.
          </p>
          <GoogleSignInButton size="sm" cta="ai_assistant">
            Sign in with Google
          </GoogleSignInButton>
        </div>
      )}

      {/* State 2: Authenticated but no sheet connected */}
      {!hasUserData && isAuthenticated && !hasSheet && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground max-w-sm text-pretty text-sm">
            Set up your Google Sheet to share your personal lifting data with
            the AI.
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

      {/* State 3: User has data (GSheet or CSV import) - show sharing checkboxes */}
      {hasUserData && (
        <div className={cn(!hasPersonalData && "pointer-events-none opacity-50")}>
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
            {renderTrainingOption({
              id: "records-checkbox",
              keyName: "records",
              label: "Personal records, lifetime and yearly",
            })}
            {renderTrainingOption({
              id: "frequency-checkbox",
              keyName: "frequency",
              label: "Lift frequency and timeline metadata",
            })}
            {renderTrainingOption({
              id: "training-load-checkbox",
              keyName: "trainingLoad",
              label: "Training load and tonnage trends",
            })}
            {renderTrainingOption({
              id: "consistency-checkbox",
              keyName: "consistency",
              label: "Consistency ratings",
            })}
            {renderTrainingOption({
              id: "session-data-checkbox",
              keyName: "sessionData",
              label: "Detailed data from recent sessions",
            })}
          </div>
        </div>
      )}

      <div className="text-muted-foreground mt-5 text-sm">
        <p className="max-w-sm text-pretty">
          Your lifting data stays in your browser. Only selected summary points
          are sent with your assistant messages.
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
    </>
  );

  function renderTrainingOption({ id, keyName, label }) {
    return (
      <div className="group flex items-center gap-2">
        <Checkbox
          id={id}
          checked={selectedOptions[keyName]}
          onCheckedChange={() => handleOptionChange(keyName)}
          disabled={!hasPersonalData}
          className="group-hover:border-blue-500"
        />
        <Label
          htmlFor={id}
          className={cn(
            "cursor-pointer hover:underline",
            !selectedOptions[keyName] && "text-muted-foreground/50",
          )}
        >
          {label}
        </Label>
      </div>
    );
  }

  if (embedded) {
    return <section className="lg:border-l lg:pl-10">{content}</section>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Talk To Your Lifting Data</CardTitle>
        <CardDescription>
          {hasPersonalData && "Data successfully loaded and available."}
          {!hasPersonalData && hasUserData && isLoading && "Loading your data..."}
          {!hasPersonalData && hasUserData && !isLoading &&
            "No lifting data found"}
          {!hasUserData && isUnauthenticated && "Sign in to share your lifting data with the AI"}
          {!hasUserData && isAuthenticated && !hasSheet &&
            "Set up your Google Sheet to get started"}
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
