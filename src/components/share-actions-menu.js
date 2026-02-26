import { Fragment } from "react";
import { Check, Copy, LoaderCircle, Mail, MoreHorizontal } from "lucide-react";
import { ShareCopyButton } from "@/components/share-copy-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ACTION_ICONS = {
  copy_image: Copy,
  copy_text: Copy,
  email_me: Mail,
};

function ShareActionIcon({ action }) {
  if (action.isLoading) {
    return <LoaderCircle className="h-4 w-4 animate-spin" />;
  }

  if (action.isSuccess) {
    return <Check className="h-4 w-4 text-green-600" />;
  }

  const Icon = action.icon || ACTION_ICONS[action.id] || MoreHorizontal;
  return <Icon className="h-4 w-4" />;
}

/**
 * Dropdown wrapper around ShareCopyButton for multi-action share/copy flows.
 *
 * @param {Object} props
 * @param {Array} props.actions
 * @param {string} [props.label]
 * @param {string} [props.tooltip]
 * @param {boolean} [props.iconOnly]
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 * @param {Function} [props.onPressAnalytics]
 * @param {string} [props.variant]
 * @param {string} [props.size]
 * @param {string} [props.align]
 */
export function ShareActionsMenu({
  actions = [],
  label = "Share",
  tooltip,
  iconOnly = false,
  disabled = false,
  className,
  onPressAnalytics,
  variant,
  size,
  align = "end",
}) {
  const visibleActions = actions.filter((action) => action && action.hidden !== true);
  const hasDangerAction = visibleActions.some((action) => action.tone === "danger");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <ShareCopyButton
          label={label}
          tooltip={tooltip}
          iconOnly={iconOnly}
          disabled={disabled}
          className={className}
          onPressAnalytics={onPressAnalytics}
          variant={variant}
          size={size}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[220px]">
        {visibleActions.map((action, index) => {
          const isLastPrimary = !hasDangerAction && index === visibleActions.length - 1;
          const shouldInsertSeparator =
            action.tone === "danger" && index > 0 && visibleActions[index - 1]?.tone !== "danger";

          return (
            <Fragment key={action.id}>
              {shouldInsertSeparator ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                disabled={action.disabled || action.isLoading}
                onSelect={(event) => {
                  action.onSelect?.(event);
                }}
                className={action.tone === "danger" ? "text-destructive focus:text-destructive" : undefined}
              >
                <ShareActionIcon action={action} />
                <span>{action.isSuccess ? (action.successLabel || action.label) : action.label}</span>
                {action.description ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {action.description}
                  </span>
                ) : null}
              </DropdownMenuItem>
              {!isLastPrimary && index < visibleActions.length - 1 && action.separatorAfter ? (
                <DropdownMenuSeparator />
              ) : null}
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
