"use client";;
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

export const Suggestions = ({
  className,
  children,
  ...props
}) => (
  <div className={cn("flex flex-wrap items-center gap-2", className)} {...props}>
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
  const handleClick = useCallback(() => {
    onClick?.(suggestion);
  }, [onClick, suggestion]);

  return (
    <Button
      className={cn("cursor-pointer rounded-full px-4", className)}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}>
      {children || suggestion}
    </Button>
  );
};
