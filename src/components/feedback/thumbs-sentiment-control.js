import { ThumbsUp, ThumbsDown } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

const MotionButton = motion.create(Button);

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
      <MotionButton
        variant={value === "positive" ? "default" : "outline"}
        size={size}
        className={`${buttonClassName} ${value === "positive" ? "border-green-500 bg-green-500/90 text-white hover:bg-green-500" : ""}`}
        onClick={() => onVote("positive")}
        aria-label={positiveAriaLabel}
        animate={
          value === "positive"
            ? { scale: [1, 1.3, 1] }
            : { scale: 1 }
        }
        transition={{ type: "spring", stiffness: 500, damping: 12 }}
      >
        <ThumbsUp className={iconClassName} />
      </MotionButton>
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
