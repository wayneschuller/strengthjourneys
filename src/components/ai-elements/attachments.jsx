"use client";;
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import {
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  Music2Icon,
  PaperclipIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { createContext, useCallback, useContext, useMemo } from "react";

// ============================================================================
// Utility Functions
// ============================================================================

export const getMediaCategory = data => {
  if (data.type === "source-document") {
    return "source";
  }

  const mediaType = data.mediaType ?? "";

  if (mediaType.startsWith("image/")) {
    return "image";
  }
  if (mediaType.startsWith("video/")) {
    return "video";
  }
  if (mediaType.startsWith("audio/")) {
    return "audio";
  }
  if (mediaType.startsWith("application/") || mediaType.startsWith("text/")) {
    return "document";
  }

  return "unknown";
};

export const getAttachmentLabel = data => {
  if (data.type === "source-document") {
    return data.title || data.filename || "Source";
  }

  const category = getMediaCategory(data);
  return data.filename || (category === "image" ? "Image" : "Attachment");
};

const renderAttachmentImage = (
  url,
  filename,
  isGrid
) =>
  isGrid ? (
    <img
      alt={filename || "Image"}
      className="size-full object-cover"
      height={96}
      src={url}
      width={96} />
  ) : (
    <img
      alt={filename || "Image"}
      className="size-full rounded object-cover"
      height={20}
      src={url}
      width={20} />
  );

const AttachmentsContext = createContext(null);

const AttachmentContext = createContext(null);

// ============================================================================
// Hooks
// ============================================================================

export const useAttachmentsContext = () =>
  useContext(AttachmentsContext) ?? { variant: "grid" };

export const useAttachmentContext = () => {
  const ctx = useContext(AttachmentContext);
  if (!ctx) {
    throw new Error("Attachment components must be used within <Attachment>");
  }
  return ctx;
};

export const Attachments = ({
  variant = "grid",
  className,
  children,
  ...props
}) => {
  const contextValue = useMemo(() => ({ variant }), [variant]);

  return (
    <AttachmentsContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex items-start",
          variant === "list" ? "flex-col gap-2" : "flex-wrap gap-2",
          variant === "grid" && "ml-auto w-fit",
          className
        )}
        {...props}>
        {children}
      </div>
    </AttachmentsContext.Provider>
  );
};

export const Attachment = ({
  data,
  onRemove,
  className,
  children,
  ...props
}) => {
  const { variant } = useAttachmentsContext();
  const mediaCategory = getMediaCategory(data);

  const contextValue = useMemo(
    () => ({ data, mediaCategory, onRemove, variant }),
    [data, mediaCategory, onRemove, variant]
  );

  return (
    <AttachmentContext.Provider value={contextValue}>
      <div
        className={cn(
          "group relative",
          variant === "grid" && "size-24 overflow-hidden rounded-lg",
          variant === "inline" && [
            "flex h-8 cursor-pointer select-none items-center gap-1.5",
            "rounded-md border border-border px-1.5",
            "font-medium text-sm transition-all",
            "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
          ],
          variant === "list" && [
            "flex w-full items-center gap-3 rounded-lg border p-3",
            "hover:bg-accent/50",
          ],
          className
        )}
        {...props}>
        {children}
      </div>
    </AttachmentContext.Provider>
  );
};

export const AttachmentPreview = ({
  fallbackIcon,
  className,
  ...props
}) => {
  const { data, mediaCategory, variant } = useAttachmentContext();

  const iconSize = variant === "inline" ? "size-3" : "size-4";

  const renderIcon = (Icon) => (
    <Icon className={cn(iconSize, "text-muted-foreground")} />
  );

  const renderContent = () => {
    if (mediaCategory === "image" && data.type === "file" && data.url) {
      return renderAttachmentImage(data.url, data.filename, variant === "grid");
    }

    if (mediaCategory === "video" && data.type === "file" && data.url) {
      return <video className="size-full object-cover" muted src={data.url} />;
    }

    const iconMap = {
      audio: Music2Icon,
      document: FileTextIcon,
      image: ImageIcon,
      source: GlobeIcon,
      unknown: PaperclipIcon,
      video: VideoIcon,
    };

    const Icon = iconMap[mediaCategory];
    return fallbackIcon ?? renderIcon(Icon);
  };

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        variant === "grid" && "size-full bg-muted",
        variant === "inline" && "size-5 rounded bg-background",
        variant === "list" && "size-12 rounded bg-muted",
        className
      )}
      {...props}>
      {renderContent()}
    </div>
  );
};

export const AttachmentInfo = ({
  showMediaType = false,
  className,
  ...props
}) => {
  const { data, variant } = useAttachmentContext();
  const label = getAttachmentLabel(data);

  if (variant === "grid") {
    return null;
  }

  return (
    <div className={cn("min-w-0 flex-1", className)} {...props}>
      <span className="block truncate">{label}</span>
      {showMediaType && data.mediaType && (
        <span className="block truncate text-muted-foreground text-xs">
          {data.mediaType}
        </span>
      )}
    </div>
  );
};

export const AttachmentRemove = ({
  label = "Remove",
  className,
  children,
  ...props
}) => {
  const { onRemove, variant } = useAttachmentContext();

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onRemove?.();
  }, [onRemove]);

  if (!onRemove) {
    return null;
  }

  return (
    <Button
      aria-label={label}
      className={cn(variant === "grid" && [
        "absolute top-2 right-2 size-6 rounded-full p-0",
        "bg-background/80 backdrop-blur-sm",
        "opacity-0 transition-opacity group-hover:opacity-100",
        "hover:bg-background",
        "[&>svg]:size-3",
      ], variant === "inline" && [
        "size-5 rounded p-0",
        "opacity-0 transition-opacity group-hover:opacity-100",
        "[&>svg]:size-2.5",
      ], variant === "list" && ["size-8 shrink-0 rounded p-0", "[&>svg]:size-4"], className)}
      onClick={handleClick}
      type="button"
      variant="ghost"
      {...props}>
      {children ?? <XIcon />}
      <span className="sr-only">{label}</span>
    </Button>
  );
};

export const AttachmentHoverCard = ({
  openDelay = 0,
  closeDelay = 0,
  ...props
}) => (
  <HoverCard closeDelay={closeDelay} openDelay={openDelay} {...props} />
);

export const AttachmentHoverCardTrigger = (
  props
) => <HoverCardTrigger {...props} />;

export const AttachmentHoverCardContent = ({
  align = "start",
  className,
  ...props
}) => (
  <HoverCardContent align={align} className={cn("w-auto p-2", className)} {...props} />
);

export const AttachmentEmpty = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      "flex items-center justify-center p-4 text-muted-foreground text-sm",
      className
    )}
    {...props}>
    {children ?? "No attachments"}
  </div>
);
