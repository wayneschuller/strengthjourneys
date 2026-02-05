"use client";;
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BotIcon } from "lucide-react";
import { memo } from "react";

import { CodeBlock } from "./code-block";

export const Agent = memo(({
  className,
  ...props
}) => (
  <div
    className={cn("not-prose w-full rounded-md border", className)}
    {...props} />
));

export const AgentHeader = memo(({
  className,
  name,
  model,
  ...props
}) => (
  <div
    className={cn("flex w-full items-center justify-between gap-4 p-3", className)}
    {...props}>
    <div className="flex items-center gap-2">
      <BotIcon className="size-4 text-muted-foreground" />
      <span className="font-medium text-sm">{name}</span>
      {model && (
        <Badge className="font-mono text-xs" variant="secondary">
          {model}
        </Badge>
      )}
    </div>
  </div>
));

export const AgentContent = memo(({
  className,
  ...props
}) => (
  <div className={cn("space-y-4 p-4 pt-0", className)} {...props} />
));

export const AgentInstructions = memo(({
  className,
  children,
  ...props
}) => (
  <div className={cn("space-y-2", className)} {...props}>
    <span className="font-medium text-muted-foreground text-sm">
      Instructions
    </span>
    <div className="rounded-md bg-muted/50 p-3 text-muted-foreground text-sm">
      <p>{children}</p>
    </div>
  </div>
));

export const AgentTools = memo(({
  className,
  ...props
}) => (
  <div className={cn("space-y-2", className)}>
    <span className="font-medium text-muted-foreground text-sm">Tools</span>
    <Accordion className="rounded-md border" {...props} />
  </div>
));

export const AgentTool = memo(({
  className,
  tool,
  value,
  ...props
}) => {
  const schema =
    "jsonSchema" in tool && tool.jsonSchema
      ? tool.jsonSchema
      : tool.inputSchema;

  return (
    <AccordionItem
      className={cn("border-b last:border-b-0", className)}
      value={value}
      {...props}>
      <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
        {tool.description ?? "No description"}
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-3">
        <div className="rounded-md bg-muted/50">
          <CodeBlock code={JSON.stringify(schema, null, 2)} language="json" />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
});

export const AgentOutput = memo(({
  className,
  schema,
  ...props
}) => (
  <div className={cn("space-y-2", className)} {...props}>
    <span className="font-medium text-muted-foreground text-sm">
      Output Schema
    </span>
    <div className="rounded-md bg-muted/50">
      <CodeBlock code={schema} language="typescript" />
    </div>
  </div>
));

Agent.displayName = "Agent";
AgentHeader.displayName = "AgentHeader";
AgentContent.displayName = "AgentContent";
AgentInstructions.displayName = "AgentInstructions";
AgentTools.displayName = "AgentTools";
AgentTool.displayName = "AgentTool";
AgentOutput.displayName = "AgentOutput";
