/**
 * Shared slider. `aria-label` is applied to the thumb, not the root: the
 * thumb is the element with role="slider". Optional `tooltip` lives inside
 * the thumb so it follows Radix's transform; wrapping the thumb in
 * TooltipTrigger fights pointer capture while dragging.
 */

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const THUMB_CLASS =
  "relative block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const Slider = React.forwardRef(
  ({ className, "aria-label": ariaLabel, tooltip, ...props }, ref) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "group/slider relative flex w-full touch-none items-center select-none",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="bg-secondary relative h-2 w-full grow overflow-hidden rounded-full">
        <SliderPrimitive.Range className="bg-primary absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb aria-label={ariaLabel} className={THUMB_CLASS}>
        {tooltip != null && tooltip !== false && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2",
              "bg-popover text-popover-foreground rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums shadow-md",
              "opacity-0 transition-opacity duration-150",
              "group-focus-within/slider:opacity-100 group-hover/slider:opacity-100 group-active/slider:opacity-100",
            )}
          >
            {tooltip}
          </span>
        )}
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  ),
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
