"use client";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "lucide-react";

export const Sources = ({
  className,
  children,
  ...props
}) => (
  <Collapsible className={cn("w-full", className)} {...props}>
    {children}
  </Collapsible>
);

export const SourcesTrigger = ({
  count,
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
          <span>Used {count} source{count !== 1 ? "s" : ""}</span>
          <ChevronDownIcon className="size-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </>
      )}
    </Button>
  </CollapsibleTrigger>
);

export const SourcesContent = ({
  className,
  children,
  ...props
}) => (
  <CollapsibleContent
    className={cn(
      "mt-2 space-y-2 rounded-lg border bg-muted/50 p-3",
      className
    )}
    {...props}>
    {children}
  </CollapsibleContent>
);

export const Source = ({
  href,
  title,
  className,
  ...props
}) => (
  <a
    className={cn(
      "block rounded-md border bg-background p-2 text-sm transition-colors hover:bg-accent",
      className
    )}
    href={href}
    rel="noopener noreferrer"
    target="_blank"
    {...props}>
    <div className="truncate font-medium">{title}</div>
    <div className="truncate text-xs text-muted-foreground">{href}</div>
  </a>
);
