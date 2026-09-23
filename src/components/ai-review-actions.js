/**
 * Compact AI-review and copy actions shared by data-rich cards.
 *
 * The closed robot stays quiet in dense card headers. Hover, focus, click, or
 * tap reveals the full actions. Consumers deliberately author the rich text
 * payload; only the image path reads from the rendered card.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Check, Copy, ImageIcon, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { stashAiAssistantPrompt } from "@/lib/ai-review-prompts";
import { cn } from "@/lib/utils";

const COPY_RESET_DELAY_MS = 2500;

export function buildCardCopyText({ title, subtitle, lines = [] }) {
  const formattedLines = lines.map((line) => {
    if (line.endsWith(":")) return humanizeCopyLabel(line.slice(0, -1)) + ":";
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) return line;
    return `${humanizeCopyLabel(line.slice(0, separatorIndex))}: ${line.slice(separatorIndex + 1)}`;
  });

  const headingLines = [title, subtitle].filter(Boolean);
  return [...headingLines, "", ...formattedLines].join("\n");
}

export function AiReviewActions({
  aiReviewLink,
  copyText,
  contentRef,
  className,
  showText = true,
}) {
  const { toast } = useToast();
  const rootRef = useRef(null);
  const resetTimerRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [copyState, setCopyState] = useState(null);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const isOpen = isHovered || isFocused || isPinnedOpen;

  useEffect(() => {
    const closeWhenClickingOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsPinnedOpen(false);
    };
    document.addEventListener("pointerdown", closeWhenClickingOutside);
    return () => {
      document.removeEventListener("pointerdown", closeWhenClickingOutside);
      window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  if (!aiReviewLink) return null;

  const showCopySuccess = (kind) => {
    window.clearTimeout(resetTimerRef.current);
    setCopyState(kind);
    resetTimerRef.current = window.setTimeout(
      () => setCopyState(null),
      COPY_RESET_DELAY_MS,
    );
  };

  const handleCopyText = async () => {
    try {
      if (!copyText?.trim()) throw new Error("No card text available");
      await navigator.clipboard.writeText(copyText);
      showCopySuccess("text");
    } catch {
      toast({ variant: "destructive", title: "Could not copy the text" });
    }
  };

  const handleCopyImage = async () => {
    if (!contentRef?.current || isCopyingImage) return;
    setIsCopyingImage(true);
    try {
      const blobPromise = captureCardAsPng(contentRef.current);
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blobPromise }),
          ]);
          showCopySuccess("image");
        } catch {
          downloadBlob(await blobPromise, "strength-journeys-card.png");
          toast({ title: "Image saved" });
        }
      } else {
        downloadBlob(await blobPromise, "strength-journeys-card.png");
        toast({ title: "Image saved" });
      }
    } catch {
      toast({ variant: "destructive", title: "Could not copy the image" });
    } finally {
      setIsCopyingImage(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn("relative h-8 w-8 shrink-0", className)}
      data-copy-exclude
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget))
          setIsFocused(false);
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "absolute right-0 h-8 w-8 transition-opacity",
          isOpen && "pointer-events-none opacity-0",
        )}
        aria-label="AI review and copy options"
        aria-expanded={isOpen}
        onClick={() => setIsPinnedOpen((open) => !open)}
      >
        <Bot className="h-4 w-4" />
      </Button>

      <div
        className={cn(
          "bg-card absolute top-0 right-0 z-20 flex h-8 items-center gap-1 rounded-md border p-0.5 shadow-sm transition-all duration-150",
          isOpen
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none translate-x-1 opacity-0",
        )}
        aria-hidden={!isOpen}
      >
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 whitespace-nowrap"
        >
          <Link
            href={aiReviewLink.href}
            tabIndex={isOpen ? 0 : -1}
            onClick={() => stashAiAssistantPrompt(aiReviewLink)}
          >
            <Bot className="h-4 w-4" />
            <span>AI review</span>
          </Link>
        </Button>
        {showText && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 whitespace-nowrap"
            tabIndex={isOpen ? 0 : -1}
            onClick={handleCopyText}
          >
            {copyState === "text" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span>{copyState === "text" ? "Text copied" : "Copy text"}</span>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 whitespace-nowrap"
          tabIndex={isOpen ? 0 : -1}
          disabled={isCopyingImage}
          onClick={handleCopyImage}
        >
          {isCopyingImage ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : copyState === "image" ? (
            <Check className="h-4 w-4" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          <span>{copyState === "image" ? "Image copied" : "Copy image"}</span>
        </Button>
      </div>
    </div>
  );
}

async function captureCardAsPng(node) {
  const html2canvas = (await import("html2canvas-pro")).default;
  const canvas = await html2canvas(node, {
    backgroundColor: window.getComputedStyle(node).backgroundColor,
    ignoreElements: (element) => element.hasAttribute("data-copy-exclude"),
    scale: Math.min(window.devicePixelRatio || 1, 2),
    useCORS: true,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("PNG capture failed")),
      "image/png",
    );
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function humanizeCopyLabel(label) {
  const words = label.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
