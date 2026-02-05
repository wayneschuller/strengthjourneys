import { cn } from "@/lib/utils";
import { Panel as PanelPrimitive } from "@xyflow/react";

export const Panel = ({
  className,
  ...props
}) => (
  <PanelPrimitive
    className={cn("m-4 overflow-hidden rounded-md border bg-card p-1", className)}
    {...props} />
);
