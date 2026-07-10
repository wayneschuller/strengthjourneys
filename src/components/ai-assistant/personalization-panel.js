/**
 * Collapsible personalization surface for the AI assistant. Keeps one-time
 * context setup discoverable without permanently competing with the chat.
 */
import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TRAINING_OPTION_KEYS = [
  "records",
  "trainingLoad",
  "frequency",
  "consistency",
  "sessionData",
];

export function PersonalizationPanel({
  bioEnabled,
  children,
  trainingOptions,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const sharedTrainingCount = TRAINING_OPTION_KEYS.filter(
    (key) => trainingOptions?.[key],
  ).length;
  const hasPersonalization = bioEnabled || sharedTrainingCount > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="p-0">
          <CollapsibleTrigger className="group flex w-full items-center gap-3 px-6 py-5 text-left">
            <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">Personalize your assistant</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                {hasPersonalization
                  ? getPersonalizationSummary({
                      bioEnabled,
                      sharedTrainingCount,
                    })
                  : "No personal context currently shared"}
              </p>
            </div>
            <span className="text-muted-foreground hidden text-sm font-medium sm:inline">
              {isOpen ? "Close" : "Set up"}
            </span>
            <ChevronDown
              className={cn(
                "text-muted-foreground size-5 shrink-0 transition-transform",
                isOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="border-t pt-6">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">{children}</div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function getPersonalizationSummary({ bioEnabled, sharedTrainingCount }) {
  const parts = [];

  if (bioEnabled) parts.push("Athlete profile shared");
  if (sharedTrainingCount > 0) {
    parts.push(
      `${sharedTrainingCount} training ${sharedTrainingCount === 1 ? "category" : "categories"} shared`,
    );
  }

  return parts.join(" · ");
}
