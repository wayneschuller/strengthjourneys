import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Reusable thumbs sentiment control.
 *
 * @param {Object} props
 * @param {"positive"|"negative"|null} [props.value]
 * @param {(sentiment: "positive" | "negative") => void} props.onVote
 * @param {"sm"|"lg"} [props.size]
 * @param {string} [props.wrapperClassName]
 * @param {string} [props.buttonClassName]
 * @param {string} [props.iconClassName]
 * @param {string} [props.positiveAriaLabel]
 * @param {string} [props.negativeAriaLabel]
 */
export function ThumbsSentimentControl({
  value = null,
  onVote,
  size = "sm",
  wrapperClassName = "flex items-center gap-2",
  buttonClassName = "",
  iconClassName = "h-4 w-4",
  positiveAriaLabel = "Thumbs up",
  negativeAriaLabel = "Thumbs down",
}) {
  return (
    <div className={wrapperClassName}>
      <Button
        variant={value === "positive" ? "default" : "outline"}
        size={size}
        className={buttonClassName}
        onClick={() => onVote("positive")}
        aria-label={positiveAriaLabel}
      >
        <ThumbsUp className={iconClassName} />
      </Button>
      <Button
        variant={value === "negative" ? "default" : "outline"}
        size={size}
        className={buttonClassName}
        onClick={() => onVote("negative")}
        aria-label={negativeAriaLabel}
      >
        <ThumbsDown className={iconClassName} />
      </Button>
    </div>
  );
}
