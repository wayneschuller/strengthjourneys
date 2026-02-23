import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import React from "react";

export const Attachments = ({
  variant = "inline",
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      variant === "inline" && "flex flex-wrap gap-2",
      variant === "stack" && "flex flex-col gap-2",
      className
    )}
    {...props}>
    {children}
  </div>
);

export const Attachment = ({
  data,
  onRemove,
  className,
  children,
  ...props
}) => {
  const handleRemove = () => {
    if (data?.id && onRemove) {
      onRemove(data.id);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-lg border bg-muted/50 p-2",
        className
      )}
      {...props}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === AttachmentRemove) {
            return React.cloneElement(child, { onRemove: handleRemove });
          }
          if (child.type === AttachmentPreview) {
            return React.cloneElement(child, { data });
          }
        }
        return child;
      })}
    </div>
  );
};

export const AttachmentPreview = ({
  data,
  className,
  ...props
}) => {
  // Render preview based on attachment type
  if (data?.mediaType?.startsWith("image/")) {
    return (
      <img
        alt={data.filename || "Attachment"}
        className={cn(
          "h-10 w-10 rounded object-cover",
          className
        )}
        src={data.url}
        {...props}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded bg-background text-xs",
        className
      )}
      {...props}>
      📎
    </div>
  );
};

export const AttachmentRemove = ({
  className,
  onRemove,
  ...props
}) => {
  const handleClick = (e) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <Button
      className={cn(
        "absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100",
        className
      )}
      onClick={handleClick}
      size="icon"
      type="button"
      variant="destructive"
      {...props}>
      <XIcon className="h-3 w-3" />
    </Button>
  );
};
