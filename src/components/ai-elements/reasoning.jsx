"use client";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useState, useEffect } from "react";

export const Reasoning = ({
  className,
  isStreaming = false,
  children,
  ...props
}) => {
  const [open, setOpen] = useState(isStreaming);

  useEffect(() => {
    if (isStreaming) {
      setOpen(true);
    }
  }, [isStreaming]);

  return (
    <Collapsible
      className={cn("w-full", className)}
      open={open}
      onOpenChange={setOpen}
      {...props}>
      {children}
    </Collapsible>
  );
};

export const ReasoningTrigger = ({
  className,
  children,
  ...props
}) => (
  <CollapsibleTrigger asChild>
    <Button
      className={cn(
        "h-auto gap-1.5 rounded-full border px-3 py-1.5 text-xs font-normal",
        className
      )}
      size="sm"
      variant="outline"
      {...props}>
      {children ?? (
        <>
          <span>Show reasoning</span>
          <ChevronDownIcon className="size-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </>
      )}
    </Button>
  </CollapsibleTrigger>
);

export const ReasoningContent = ({
  className,
  children,
  ...props
}) => (
  <CollapsibleContent
    className={cn(
      "mt-2 space-y-2 rounded-lg border bg-muted/50 p-3 font-mono text-xs",
      className
    )}
    {...props}>
    {children}
  </CollapsibleContent>
);
