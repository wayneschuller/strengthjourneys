import { cn } from "@/lib/utils";
import { Loader2Icon } from "lucide-react";

export const Loader = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "flex items-center justify-center gap-2 text-sm text-muted-foreground",
      className
    )}
    {...props}>
    <Loader2Icon className="h-4 w-4 animate-spin" />
    <span>Thinking…</span>
  </div>
);
