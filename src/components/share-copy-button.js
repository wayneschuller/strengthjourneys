
import { Check, LoaderCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Uniform share/copy button for social sharing across the app.
 * Consistent defaults; customizable via props.
 *
 * @param {object} props
 * @param {string} [props.label="Copy"] - Button label (hidden when iconOnly)
 * @param {boolean} [props.iconOnly=false] - Icon-only, no label (compact)
 * @param {boolean} [props.isLoading=false] - Show loading spinner
 * @param {boolean} [props.isSuccess=false] - Show success state (check icon + successLabel)
 * @param {string} [props.successLabel="Copied"] - Label shown when isSuccess=true
 * @param {string} [props.tooltip] - Tooltip text (wraps in Tooltip when provided)
 * @param {string} [props.variant="outline"] - Button variant
 * @param {string} [props.size="sm"] - Button size ("sm" | "default" | "lg" | "icon")
 * @param {string} [props.className] - Extra class names
 * @param {function} [props.onPressAnalytics] - Optional analytics callback fired when button is pressed
 * @param {function} [props.onClick] - Click handler
 * @param {boolean} [props.disabled] - Disabled state
 */
export function ShareCopyButton({
  label = "Copy",
  iconOnly = false,
  isLoading = false,
  isSuccess = false,
  successLabel = "Copied",
  tooltip,
  variant = "outline",
  size = "sm",
  className,
  onPressAnalytics,
  onClick,
  disabled,
  ...rest
}) {
  const handleClick = (event) => {
    try {
      onPressAnalytics?.(event);
    } catch (error) {
      console.error("ShareCopyButton analytics callback failed:", error);
    }
    onClick?.(event);
  };

  const content = (
    <Button
      variant={variant}
      size={iconOnly ? "icon" : size}
      className={cn("gap-2", iconOnly && "h-9 w-9", className)}
      onClick={handleClick}
      disabled={disabled ?? isLoading}
      aria-label={tooltip || label}
      {...rest}
    >
      {isLoading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <span className="relative h-4 w-4 shrink-0">
          <Share2
            className={cn(
              "absolute inset-0 h-4 w-4 transition-all duration-200",
              isSuccess
                ? "scale-75 -rotate-12 opacity-0"
                : "scale-100 rotate-0 opacity-100",
            )}
          />
          <Check
            className={cn(
              "absolute inset-0 h-4 w-4 text-green-600 transition-all duration-200",
              isSuccess
                ? "scale-100 rotate-0 opacity-100"
                : "scale-75 rotate-12 opacity-0",
            )}
          />
        </span>
      )}
      {!iconOnly && (label || successLabel) && (
        <span className="relative inline-grid" aria-live="polite">
          <span className="invisible col-start-1 row-start-1">
            {label?.length >= successLabel?.length ? label : successLabel}
          </span>
          <span
            className={cn(
              "col-start-1 row-start-1 transition-all duration-200",
              isSuccess
                ? "translate-y-0 opacity-100"
                : "translate-y-0.5 opacity-0",
            )}
          >
            {successLabel}
          </span>
          <span
            className={cn(
              "col-start-1 row-start-1 transition-all duration-200",
              isSuccess
                ? "-translate-y-0.5 opacity-0"
                : "translate-y-0 opacity-100",
            )}
          >
            {label}
          </span>
        </span>
      )}
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>
            {isLoading ? "Generating..." : isSuccess ? successLabel : tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}
