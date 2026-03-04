import { ShareCopyButton } from "@/components/share-copy-button";
import { useTransientSuccess } from "@/hooks/use-transient-success";
import { cn } from "@/lib/utils";

/**
 * Compact icon copy button used for lift/share snippets.
 * Supports either controlled success state or local transient success.
 */
export function LiftResultCopyButton({
  liftType,
  label,
  tooltip,
  onCopy,
  onPressAnalytics,
  className,
  isLoading = false,
  isSuccess: controlledSuccess,
  disabled,
  ...rest
}) {
  const { isSuccess: localSuccess, triggerSuccess } = useTransientSuccess();
  const isSuccess = controlledSuccess ?? localSuccess;

  const resolvedLabel = label ?? (liftType ? `Copy ${liftType} result` : "Copy result");
  const resolvedTooltip =
    tooltip ??
    (liftType
      ? `Copy e1rm estimate with ${liftType} rating included`
      : "Copy result");

  const handleClick = async () => {
    try {
      const didCopy = await onCopy?.();
      if (controlledSuccess === undefined && didCopy !== false) {
        triggerSuccess();
      }
    } catch (error) {
      console.error("LiftResultCopyButton copy failed:", error);
    }
  };

  return (
    <ShareCopyButton
      iconOnly
      size="icon"
      label={resolvedLabel}
      tooltip={resolvedTooltip}
      isLoading={isLoading}
      isSuccess={isSuccess}
      disabled={disabled ?? isLoading}
      className={cn("h-6 w-6 text-muted-foreground/50 hover:text-foreground", className)}
      onPressAnalytics={onPressAnalytics}
      onClick={handleClick}
      {...rest}
    />
  );
}
