import { ThumbsUp, ThumbsDown } from "lucide-react";
import { motion, useAnimationControls } from "motion/react";
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
  const controls = useAnimationControls();

  function handlePositiveClick() {
    controls.start({
      scale: [1, 1.4, 0.9, 1.15, 1],
      rotate: [0, -12, 8, -4, 0],
      transition: { duration: 0.5, ease: "easeInOut" },
    });
    onVote("positive");
  }

  return (
    <div className={wrapperClassName}>
      <Button
        variant={value === "positive" ? "default" : "outline"}
        size={size}
        className={`${buttonClassName} ${value === "positive" ? "!border-green-500 !bg-green-500 !text-white hover:!bg-green-600" : ""}`}
        onClick={handlePositiveClick}
        aria-label={positiveAriaLabel}
      >
        <motion.span animate={controls} className="inline-flex">
          <ThumbsUp className={iconClassName} />
        </motion.span>
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
