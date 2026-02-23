
import { Share2, LoaderCircle } from "lucide-react";
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
 * @param {string} [props.tooltip] - Tooltip text (wraps in Tooltip when provided)
 * @param {string} [props.variant="outline"] - Button variant
 * @param {string} [props.size="sm"] - Button size ("sm" | "default" | "lg" | "icon")
 * @param {string} [props.className] - Extra class names
 * @param {function} [props.onClick] - Click handler
 * @param {boolean} [props.disabled] - Disabled state
 */
export function ShareCopyButton({
  label = "Copy",
  iconOnly = false,
  isLoading = false,
  tooltip,
  variant = "outline",
  size = "sm",
  className,
  onClick,
  disabled,
  ...rest
}) {
  const content = (
    <Button
      variant={variant}
      size={iconOnly ? "icon" : size}
      className={cn("gap-2", iconOnly && "h-9 w-9", className)}
      onClick={onClick}
      disabled={disabled ?? isLoading}
      aria-label={tooltip || label}
      {...rest}
    >
      {isLoading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Share2 className="h-4 w-4 shrink-0" />
      )}
      {!iconOnly && label && <span>{label}</span>}
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>
            {isLoading ? "Generating..." : tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}
