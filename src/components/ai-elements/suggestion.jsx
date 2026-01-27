"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Suggestions = ({ className, children, ...props }) => (
  <div
    className={cn(
      "flex flex-wrap gap-2",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = "outline",
  size = "sm",
  children,
  ...props
}) => {
  const handleClick = () => {
    onClick?.(suggestion);
  };

  return (
    <Button
      className={cn(
        "w-auto min-w-fit cursor-pointer rounded-full px-4 whitespace-nowrap",
        className,
      )}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children || suggestion}
    </Button>
  );
};
