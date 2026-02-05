import { cn } from "@/lib/utils";
import { NodeToolbar, Position } from "@xyflow/react";

export const Toolbar = ({
  className,
  ...props
}) => (
  <NodeToolbar
    className={cn("flex items-center gap-1 rounded-sm border bg-background p-1.5", className)}
    position={Position.Bottom}
    {...props} />
);
