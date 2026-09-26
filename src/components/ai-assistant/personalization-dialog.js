/**
 * On-demand personalization controls for the AI assistant. The compact trigger
 * keeps chat primary while the dialog preserves transparent sharing choices.
 *
 * The dialog can show the exact summary text the coach receives, so nothing
 * about what is shared is left to a lifter's imagination. It is built only
 * while that preview is open, and rebuilt as the choices above change.
 */
import { useMemo, useState } from "react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children The profile and training sections.
 * @param {boolean} props.enabled Whether anything personal is shared.
 * @param {() => string} [props.buildSummary] Builds the exact text sent with each message.
 */
export function PersonalizationDialog({ children, enabled, buildSummary }) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  // buildSummary changes identity only when the lifter's choices change.
  const summary = useMemo(
    () => (isPreviewOpen && buildSummary ? buildSummary() : ""),
    [isPreviewOpen, buildSummary],
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="shrink-0 gap-2" size="sm" variant="outline">
          <SlidersHorizontal aria-hidden="true" />
          {enabled ? "Personalization on" : "Personalize"}
          {enabled && <Check aria-hidden="true" className="text-primary" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Personalize your assistant</DialogTitle>
          <DialogDescription>
            Choose what the coach knows about you. Everything switched on here
            is sent with each message, so answers can use your real numbers.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-2 md:grid-cols-2 md:gap-8">{children}</div>
        {enabled && buildSummary && (
          <Collapsible
            open={isPreviewOpen}
            onOpenChange={setIsPreviewOpen}
            className="border-t pt-4"
          >
            <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex items-center gap-2 text-sm font-medium">
              See exactly what the coach receives
              <ChevronDown
                className="size-4 transition-transform group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">
                {summary}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
        <div className="text-muted-foreground border-t pt-4 text-xs">
          These summaries are worked out in your browser and sent to the AI
          model you chose, along with your message. Your full lifting log stays
          on your device, and chats are not stored on our servers.
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
