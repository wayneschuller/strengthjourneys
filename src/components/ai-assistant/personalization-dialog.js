/**
 * On-demand personalization controls for the AI assistant. The compact trigger
 * keeps chat primary while the dialog preserves transparent sharing choices.
 */
import { Check, SlidersHorizontal } from "lucide-react";

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

export function PersonalizationDialog({ children, enabled }) {
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
            Choose which personal context can be included with your assistant
            messages.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-2 md:grid-cols-2 md:gap-8">{children}</div>
        <div className="text-muted-foreground border-t pt-4 text-xs">
          Selected profile details and training summaries are sent with your
          assistant messages. Your raw lifting history is not sent or stored.
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
