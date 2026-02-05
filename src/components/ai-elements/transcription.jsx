"use client";;
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { cn } from "@/lib/utils";
import { createContext, useCallback, useContext } from "react";

const TranscriptionContext = createContext(null);

const useTranscription = () => {
  const context = useContext(TranscriptionContext);
  if (!context) {
    throw new Error("Transcription components must be used within Transcription");
  }
  return context;
};

export const Transcription = ({
  segments,
  currentTime: externalCurrentTime,
  onSeek,
  className,
  children,
  ...props
}) => {
  const [currentTime, setCurrentTime] = useControllableState({
    defaultProp: 0,
    onChange: onSeek,
    prop: externalCurrentTime,
  });

  return (
    <TranscriptionContext.Provider
      value={{
        currentTime,
        onSeek,
        onTimeUpdate: setCurrentTime,
        segments,
      }}>
      <div
        className={cn("flex flex-wrap gap-1 text-sm leading-relaxed", className)}
        data-slot="transcription"
        {...props}>
        {segments
          .filter((segment) => segment.text.trim())
          .map((segment, index) => children(segment, index))}
      </div>
    </TranscriptionContext.Provider>
  );
};

export const TranscriptionSegment = ({
  segment,
  index,
  className,
  onClick,
  ...props
}) => {
  const { currentTime, onSeek } = useTranscription();

  const isActive =
    currentTime >= segment.startSecond && currentTime < segment.endSecond;
  const isPast = currentTime >= segment.endSecond;

  const handleClick = useCallback((event) => {
    if (onSeek) {
      onSeek(segment.startSecond);
    }
    onClick?.(event);
  }, [onSeek, segment.startSecond, onClick]);

  return (
    <button
      className={cn(
        "inline text-left",
        isActive && "text-primary",
        isPast && "text-muted-foreground",
        !(isActive || isPast) && "text-muted-foreground/60",
        onSeek && "cursor-pointer hover:text-foreground",
        !onSeek && "cursor-default",
        className
      )}
      data-active={isActive}
      data-index={index}
      data-slot="transcription-segment"
      onClick={handleClick}
      type="button"
      {...props}>
      {segment.text}
    </button>
  );
};
