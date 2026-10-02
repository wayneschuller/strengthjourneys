/**
 * Everything a set row does with its video link, kept out of the row itself:
 * the menu that opens on a saved link's mark, and the small button that adds a
 * link to a set without one. The link is edited here and nowhere else, so the
 * row's own editor only has to deal with the note.
 *
 * The menu opens on hover where there is a pointer and on tap where there is
 * not. On a phone that makes watching two taps, mark then play, which buys a
 * place for edit and remove that a bare link never had.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { Anchor as PopoverAnchor } from "@radix-ui/react-popover";
import { Copy, Link2, Pencil, Play, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getYouTubeThumbnailSrc } from "@/components/log/utils";
import { VideoLinkButton } from "@/components/log/video-link-button";
import { VideoSourceIcon } from "@/components/log/video-source-icon";

const HOVER_OPEN_DELAY_MS = 120;
const HOVER_CLOSE_DELAY_MS = 180;

function canHover() {
  return window.matchMedia("(hover: hover)").matches;
}

/**
 * A saved link's mark, with its menu: a large play target, then edit, copy
 * and remove.
 *
 * @param {Object} props
 * @param {string} props.url - The saved link.
 * @param {Object} props.source - Result of getVideoSourceMeta(url).
 * @param {(url: string) => void} props.onSave - Replace the link.
 * @param {() => void} props.onCopy - Copy the link to the clipboard.
 * @param {() => void} props.onRemove - Take the link off the set.
 */
export function SetVideoMenu({ url, source, onSave, onCopy, onRemove }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const anchorRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function setOpenSoon(next, delay) {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOpen(next);
      if (!next) setEditing(false);
    }, delay);
  }

  function close() {
    clearTimeout(timerRef.current);
    setOpen(false);
    setEditing(false);
  }

  // Someone typing a link has usually let the pointer drift off the menu.
  function closeOnLeave() {
    if (editing || !canHover()) return;
    setOpenSoon(false, HOVER_CLOSE_DELAY_MS);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <PopoverAnchor asChild>
        <span
          ref={anchorRef}
          className="inline-flex"
          onMouseEnter={() => {
            if (canHover()) setOpenSoon(true, HOVER_OPEN_DELAY_MS);
          }}
          onMouseLeave={closeOnLeave}
        >
          <VideoLinkButton
            url={url}
            source={source}
            showTooltip={false}
            onClick={(e) => {
              // With a pointer the mark is still a plain link to the video.
              if (canHover()) return;
              e.preventDefault();
              if (open) close();
              else setOpen(true);
            }}
          />
        </span>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        className="w-64 space-y-2 p-2"
        // Opening on hover must not pull focus out of whatever is being typed.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // A tap on the mark is the toggle above, not an outside press.
          if (anchorRef.current?.contains(e.target)) e.preventDefault();
        }}
        onMouseEnter={() => clearTimeout(timerRef.current)}
        onMouseLeave={closeOnLeave}
      >
        <PlayPanel url={url} source={source} />
        {editing ? (
          <VideoLinkField
            initialUrl={url}
            onSave={(nextUrl) => {
              close();
              onSave(nextUrl);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex gap-1">
            <MenuAction icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </MenuAction>
            <MenuAction
              icon={Copy}
              onClick={() => {
                close();
                onCopy();
              }}
            >
              Copy
            </MenuAction>
            <MenuAction
              icon={Trash2}
              className="hover:text-destructive"
              onClick={() => {
                close();
                onRemove();
              }}
            >
              Remove
            </MenuAction>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The link icon on a set with no video. One tap tries the clipboard through
 * `onAttachCopied`; when that finds nothing to attach, the link field opens
 * here to type or paste into.
 *
 * @param {Object} props
 * @param {() => Promise<boolean>} props.onAttachCopied - Resolves true when a copied link was attached.
 * @param {(url: string) => void} props.onSave - Save a typed or pasted link.
 * @param {string} [props.className] - Visibility and spacing from the caller.
 */
export function AttachVideoLinkButton({ onAttachCopied, onSave, className }) {
  const [open, setOpen] = useState(false);
  const label = "Attach the video link you copied";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <PopoverAnchor asChild>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "text-muted-foreground/60 hover:text-foreground rounded p-2 transition-colors md:p-1",
                  // Stays in view while its field is open, hover or not.
                  open ? "text-foreground md:opacity-100" : className,
                )}
                onClick={async () => {
                  if (open) {
                    setOpen(false);
                    return;
                  }
                  const attached = await onAttachCopied();
                  if (!attached) setOpen(true);
                }}
                aria-label={label}
              >
                <Link2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </button>
            </TooltipTrigger>
          </PopoverAnchor>
          {!open && (
            <TooltipContent side="bottom">
              <p>{label}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <PopoverContent side="top" align="end" className="w-64 p-2">
        <VideoLinkField
          initialUrl=""
          onSave={(nextUrl) => {
            setOpen(false);
            if (nextUrl) onSave(nextUrl);
          }}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

function PlayPanel({ url, source }) {
  const thumbnailSrc = getYouTubeThumbnailSrc(url);
  const playLabel = source.name ? `Watch on ${source.name}` : "Watch the video";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/play bg-muted relative flex aspect-video items-center justify-center overflow-hidden rounded-md"
    >
      {thumbnailSrc ? (
        <Image
          src={thumbnailSrc}
          alt=""
          fill
          unoptimized
          className="object-cover"
        />
      ) : (
        <VideoSourceIcon source={source} className="h-10 w-10 opacity-40" />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <span className="bg-primary text-primary-foreground absolute flex size-12 items-center justify-center rounded-full shadow-lg transition-transform group-hover/play:scale-110">
        <Play className="size-5 translate-x-px fill-current" />
      </span>
      <span className="absolute inset-x-2 bottom-1.5 text-left text-xs font-semibold text-white">
        {playLabel}
      </span>
    </a>
  );
}

function MenuAction({ icon: Icon, className, onClick, children }) {
  return (
    <button
      type="button"
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs transition-colors md:py-1.5",
        className,
      )}
      onClick={onClick}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

// The one place a set's link is typed. Enter saves, Escape backs out, and an
// emptied field saves as no link at all.
function VideoLinkField({ initialUrl, onSave, onCancel }) {
  const [draft, setDraft] = useState(initialUrl);

  return (
    <div className="flex items-center gap-1.5">
      <Link2 className="text-muted-foreground/60 size-3.5 shrink-0" />
      <input
        type="url"
        inputMode="url"
        aria-label="Video link"
        className="border-input focus:border-primary min-w-0 flex-1 border-b bg-transparent py-1 text-base focus:outline-none md:text-xs"
        value={draft}
        placeholder="Paste a video link"
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(draft.trim());
          } else if (e.key === "Escape") {
            // Back out of the field without closing the whole menu.
            e.stopPropagation();
            onCancel();
          }
        }}
        autoFocus
      />
      <button
        type="button"
        className="text-primary hover:bg-muted rounded-md px-2 py-1.5 text-xs font-semibold"
        onClick={() => onSave(draft.trim())}
      >
        Save
      </button>
    </div>
  );
}
