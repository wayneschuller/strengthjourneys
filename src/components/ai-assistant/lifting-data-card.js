import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "../ui/separator";
import { cn } from "@/lib/utils";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useSession } from "next-auth/react";

export function LiftingDataCard({ selectedOptions, setSelectedOptions }) {
  const { parsedData, isLoading } = useUserLiftingData();
  const { status: authStatus } = useSession();

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
      all: false, // Uncheck 'Check All' if individual option is toggled
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Talk To Your Lifting Data</CardTitle>
        <CardDescription>
          {authStatus === "unauthenticated" && "Sign in to share your data"}
          {authStatus === "authenticated" && parsedData && parsedData.length > 0
            ? "Data successfully loaded and available."
            : "No data loaded"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-2 text-muted-foreground">
          Select the lifting info to share with the AI:
        </div>
        <div className="space-y-2">
          <div className="group flex items-center gap-2">
            <Checkbox
              id="select-all-checkbox"
              checked={selectedOptions.all}
              onCheckedChange={handleSelectAll}
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
        <div className="mt-5 text-sm text-muted-foreground">
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
