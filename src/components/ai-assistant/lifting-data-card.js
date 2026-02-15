import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
import { Separator } from "../ui/separator";
import { cn } from "@/lib/utils";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useSession, signIn } from "next-auth/react";
import { GoogleLogo } from "@/components/hero-section";
import { DrivePickerContainer } from "@/components/drive-picker-container";
import { handleOpenFilePicker } from "@/lib/handle-open-picker";

export function LiftingDataCard({ selectedOptions, setSelectedOptions }) {
  const { parsedData, isLoading, isDemoMode, sheetInfo, selectSheet } =
    useUserLiftingData();
  const { data: session, status: authStatus } = useSession();

  const [openPicker, setOpenPicker] = useState(null);
  const [shouldLoadPicker, setShouldLoadPicker] = useState(false);

  const isUnauthenticated = authStatus === "unauthenticated";
  const isAuthenticated = authStatus === "authenticated";
  const hasSheet = isAuthenticated && !!sheetInfo?.ssid;
  const hasPersonalData =
    hasSheet && !isDemoMode && parsedData && parsedData.length > 0;

  // Load the picker when authenticated but no sheet connected
  useEffect(() => {
    if (isAuthenticated && !sheetInfo?.ssid) {
      setShouldLoadPicker(true);
    }
  }, [isAuthenticated, sheetInfo?.ssid]);

  const handlePickerReady = useCallback((picker) => {
    setOpenPicker(() => picker);
  }, []);

  const handleSelectAll = () => {
    const allChecked = !selectedOptions.all;
    setSelectedOptions({
      all: allChecked,
      records: allChecked,
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

  return (
    <Card>
      {/* Invisible picker container - loads Google Picker API */}
      {shouldLoadPicker && (
        <DrivePickerContainer
          onReady={handlePickerReady}
          trigger={shouldLoadPicker}
          oauthToken={session?.accessToken}
          selectSheet={selectSheet}
        />
      )}
      <CardHeader>
        <CardTitle>Talk To Your Lifting Data</CardTitle>
        <CardDescription>
          {isUnauthenticated && "Sign in to share your lifting data with the AI"}
          {isAuthenticated && !hasSheet &&
            "Connect your Google Sheet to get started"}
          {hasSheet && !hasPersonalData && isLoading && "Loading your data..."}
          {hasSheet && !hasPersonalData && !isLoading &&
            "No lifting data found in the connected sheet"}
          {hasPersonalData && "Data successfully loaded and available."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* State 1: Unauthenticated - prompt to sign in */}
        {isUnauthenticated && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground w-64 text-pretty text-sm">
              Sign in with Google to connect your lifting spreadsheet and share
              your data with the AI assistant.
            </p>
            <Button
              size="sm"
              className="flex items-center gap-2"
              onClick={() => signIn("google")}
            >
              <GoogleLogo size={16} />
              Sign in with Google
            </Button>
          </div>
        )}

        {/* State 2: Authenticated but no sheet connected */}
        {isAuthenticated && !hasSheet && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground w-64 text-pretty text-sm">
              Connect your Google Sheet to share your personal lifting data with
              the AI.
            </p>
            <Button
              size="sm"
              disabled={!openPicker}
              onClick={() => {
                if (openPicker) {
                  handleOpenFilePicker(openPicker);
                }
              }}
            >
              {openPicker
                ? "Connect Google Sheet"
                : "Loading sheet picker..."}
            </Button>
          </div>
        )}

        {/* State 3: Authenticated + sheet + personal data loaded */}
        {hasSheet && (
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
                    !selectedOptions.frequency && "text-muted-foreground/50",
                  )}
                >
                  Lift frequency and timeline metadata
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
                    !selectedOptions.consistency && "text-muted-foreground/50",
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
                    !selectedOptions.sessionData && "text-muted-foreground/50",
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
            Strength Journeys loads your Google Sheet lifting data directly into
            your browser. Nothing is streamed to our servers—only summary points
            are shared with the AI.{" "}
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
    </Card>
  );
}
