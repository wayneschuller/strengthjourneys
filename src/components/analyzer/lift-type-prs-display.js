"use client";

import { useState } from "react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useAthleteBioData } from "@/hooks/use-athlete-biodata";
import {
  getReadableDateString,
  getCelebrationEmoji,
} from "@/lib/processing-utils";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Play } from "lucide-react";

/**
 * Helper function to calculate strength rating for a lift
 */
const getStrengthRating = (repCount, weight, liftType, standards) => {
  if (!standards || !standards[liftType]) return null;

  const standard = standards[liftType];
  const oneRepMax = estimateE1RM(repCount, weight, "Brzycki");

  if (oneRepMax < standard.beginner) {
    return "Physically Active";
  } else if (oneRepMax < standard.intermediate) {
    return "Beginner";
  } else if (oneRepMax < standard.advanced) {
    return "Intermediate";
  } else if (oneRepMax < standard.elite) {
    return "Advanced";
  } else {
    return "Elite";
  }
};

/**
 * Helper function to get badge variant based on rating
 */
const getRatingBadgeVariant = (rating) => {
  switch (rating) {
    case "Elite":
      return "default";
    case "Advanced":
      return "default";
    case "Intermediate":
      return "secondary";
    case "Beginner":
      return "outline";
    case "Physically Active":
      return "outline";
    default:
      return "outline";
  }
};

/**
 * TruncatedText component for displaying notes with expand/collapse
 */
const TruncatedText = ({ text, className }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const truncLength = 300;

  if (!text) return null;

  const truncatedText =
    text.length > truncLength ? text.substring(0, truncLength) + "..." : text;

  return (
    <div
      className={cn("text-pretty italic text-muted-foreground", className)}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {isExpanded ? text : truncatedText}
      {text.length > truncLength && (
        <button
          className="ml-2 text-xs text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
};

/**
 * PR Card component for displaying a single rep range PR
 */
const PRCard = ({
  repRange,
  repIndex,
  liftType,
  liftColor,
  onCardClick,
  isExpanded,
  strengthRating,
}) => {
  if (!repRange || repRange.length === 0) return null;

  const pr = repRange[0]; // First item is the PR
  const repCount = repIndex + 1; // 1-10 reps
  const celebrationEmoji = getCelebrationEmoji(0); // PR is always #1

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 border-2",
        isExpanded 
          ? "ring-2" 
          : "border-transparent hover:border-foreground/50"
      )}
      style={{
        borderColor: isExpanded ? liftColor : undefined,
      }}
      onClick={onCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {repCount}RM
          </CardTitle>
          <div className="flex items-center gap-2">
            {strengthRating && (
              <Badge variant={getRatingBadgeVariant(strengthRating)}>
                {strengthRating}
              </Badge>
            )}
            <Badge
              variant="outline"
              style={{
                borderColor: liftColor,
                color: liftColor,
              }}
            >
              {celebrationEmoji} PR
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* PR Weight - Large and prominent */}
        <div>
          <div className="flex items-center gap-2">
            <div
              className="text-3xl font-bold"
              style={{ color: liftColor }}
            >
              {pr.weight}
              {pr.unitType}
            </div>
            {pr.URL && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={pr.URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary hover:text-primary/80 transition-all duration-200 hover:scale-110"
                      aria-label="Open video in new tab"
                    >
                      <Play className="h-5 w-5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open video in new tab</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {getReadableDateString(pr.date)}
          </div>
        </div>

        {/* Notes */}
        {pr.notes && (
          <TruncatedText text={pr.notes} className="mt-2" />
        )}

        {/* Additional PRs indicator */}
        {repRange.length > 1 && (
          <div className="pt-2 text-xs text-muted-foreground">
            +{repRange.length - 1} more {repCount}RM{repRange.length > 2 ? "s" : ""}
          </div>
        )}

        {/* Expand indicator */}
        <div className="flex items-center justify-center pt-2 transition-transform duration-200">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Detail view showing all lifts in a rep range
 */
const RepRangeDetailView = ({ repRange, repIndex, liftType, liftColor, standards }) => {
  if (!repRange || repRange.length === 0) return null;

  const repCount = repIndex + 1;

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-foreground">
          All {repCount}RM Lifts
        </h3>
        <p className="text-sm text-muted-foreground">
          {repRange.length} total {repCount}RM{repRange.length > 1 ? "s" : ""} recorded
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {repRange.map((lift, liftIndex) => (
          <Card
            key={liftIndex}
            className={cn(
              liftIndex === 0 && "ring-2 ring-foreground/50"
            )}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Rank and Weight */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-semibold">
                        {getCelebrationEmoji(liftIndex)} #{liftIndex + 1}
                      </span>
                      <span className="text-xl font-bold text-foreground">
                        {repCount}@{lift.weight}
                        {lift.unitType}
                      </span>
                      {getStrengthRating(repCount, lift.weight, liftType, standards) && (
                        <Badge variant={getRatingBadgeVariant(getStrengthRating(repCount, lift.weight, liftType, standards))}>
                          {getStrengthRating(repCount, lift.weight, liftType, standards)}
                        </Badge>
                      )}
                      {lift.URL && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={lift.URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-primary hover:text-primary/80 transition-all duration-200 hover:scale-110"
                                aria-label="Open video in new tab"
                              >
                                <Play className="h-5 w-5" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Open video in new tab</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {getReadableDateString(lift.date)}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {lift.notes && (
                  <TruncatedText text={lift.notes} className="mt-2" />
                )}

              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

/**
 * Main component: LiftTypeRepPRsDisplay
 * Implements hybrid approach: Card Grid (primary) + Tabs (detail view)
 */
export const LiftTypeRepPRsDisplay = ({ liftType }) => {
  const { topLiftsByTypeAndReps } = useUserLiftingData();
  const { getColor } = useLiftColors();
  const { age, bodyWeight, standards } = useAthleteBioData();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Check if we have the necessary data for strength ratings
  const hasBioData = age && bodyWeight && standards && Object.keys(standards).length > 0;

  if (!topLiftsByTypeAndReps) return null;

  const topLiftsByReps = topLiftsByTypeAndReps?.[liftType];
  if (!topLiftsByReps) return null;

  const liftColor = getColor(liftType);

  // Filter out empty rep ranges and get rep ranges with data
  const repRangesWithData = topLiftsByReps
    .map((repRange, index) => ({
      repRange,
      repIndex: index,
      repCount: index + 1,
    }))
    .filter(({ repRange }) => repRange && repRange.length > 0)
    .slice(0, 10); // Show top 10 rep ranges

  if (repRangesWithData.length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        No PRs recorded for {liftType} yet.
      </div>
    );
  }

  const handleCardClick = (repIndex) => {
    setActiveTab(`rep-${repIndex}`);
  };

  // Featured rep ranges for smaller screens
  const mobileRepTabs = repRangesWithData.filter(({ repCount }) =>
    [1, 3, 5, 10].includes(repCount),
  );

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl sm:text-2xl font-semibold">{liftType} PRs</h2>
        </div>

        {/* Mobile / tablet: only show key rep ranges to reduce crowding */}
        <div className="w-full lg:hidden">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger
              value="overview"
              className="whitespace-nowrap text-xs"
            >
              Overview
            </TabsTrigger>
            {mobileRepTabs.map(({ repIndex, repCount }) => (
              <TabsTrigger
                key={repIndex}
                value={`rep-${repIndex}`}
                className="whitespace-nowrap text-xs"
              >
                {repCount}RM
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Desktop (lg+): show full set of rep-range tabs */}
        <div className="hidden w-full overflow-x-auto lg:block">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 lg:grid-cols-11">
            <TabsTrigger value="overview" className="text-xs">
              Overview
            </TabsTrigger>
            {repRangesWithData.map(({ repIndex, repCount }) => (
              <TabsTrigger key={repIndex} value={`rep-${repIndex}`} className="text-xs">
                {repCount}RM
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview tab: summary grid of rep range PR cards */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Overview of your best {liftType} sets across different rep ranges. Click
            a card or a tab above to explore all lifts for that rep range.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {repRangesWithData.map(({ repRange, repIndex, repCount }) => {
              const pr = repRange[0];
              const strengthRating = hasBioData 
                ? getStrengthRating(repCount, pr.weight, liftType, standards)
                : null;
              
              return (
                <PRCard
                  key={repIndex}
                  repRange={repRange}
                  repIndex={repIndex}
                  liftType={liftType}
                  liftColor={liftColor}
                  onCardClick={() => handleCardClick(repIndex)}
                  isExpanded={activeTab === `rep-${repIndex}`}
                  strengthRating={strengthRating}
                />
              );
            })}
          </div>
        </TabsContent>

        {/* Per-rep-range detail tabs */}
        {repRangesWithData.map(({ repRange, repIndex }) => (
          <TabsContent
            key={repIndex}
            value={`rep-${repIndex}`}
            className="mt-4 space-y-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg sm:text-xl font-semibold">
                {repIndex + 1}RM PRs for {liftType}
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground self-start sm:self-auto"
              >
                ← Back to overview
              </button>
            </div>
            <RepRangeDetailView
              repRange={repRange}
              repIndex={repIndex}
              liftType={liftType}
              liftColor={liftColor}
              standards={hasBioData ? standards : null}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

