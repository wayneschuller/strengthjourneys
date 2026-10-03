/** @format */

import * as React from "react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

const LB_QUIPS = [
  "🦅 Freedom units activated.",
  "🇺🇸 As the Founding Fathers intended.",
  "🦅 The bald eagle nods approvingly.",
  "🍔 In God we trust, in pounds we lift.",
  "🇺🇸 Liberty, justice, and imperial units.",
  "🦅 NASA would like a word, but you do you.",
  "🏈 Football fields and pounds. Peak America.",
  "🍺 Your bar tab and your barbell: both in pounds.",
  "🇺🇸 The metric system is a communist plot.",
  "🦅 Patrick Henry said 'Give me liberty or give me kilograms.' He chose liberty.",
];

const KG_QUIPS = [
  "🇪🇺 Joined the rest of the world.",
  "🔬 Science approves.",
  "⚽ 97% of the planet welcomes you.",
  "🧪 The metric system: because 10s are nice.",
  "🏋️ Even the moon landings used metric internally.",
  "🏋️ IPF-legal units. Very official.",
  "🥐 Your European gym friends are proud.",
  "🔢 Base-10 superiority unlocked.",
  "🥖 Celsius users and kg users: kindred spirits.",
  "🧬 SI units. As nature intended.",
];

const LB_EMOJIS = ["🇺🇸", "🦅", "🏈", "🗽"];
const KG_EMOJIS = ["🏋️", "🥐", "🇪🇺", "⚽", "🥖"];

function randomQuip(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Module-level counters so the emoji cycles across clicks even if the component remounts
let lbEmojiIndex = 0;
let kgEmojiIndex = 0;

/** Returns canvas-confetti origin {x, y} (0–1) from the center of a DOM element. */
function getOriginFromRef(ref) {
  if (!ref.current) return { x: 0.5, y: 0.6 };
  const rect = ref.current.getBoundingClientRect();
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };
}

/**
 * Toggle button that switches the app between kg and lb units. Fires a toast
 * notification with a humorous quip and a small confetti burst on each toggle.
 *
 * @param {Object} props
 * @param {boolean} props.isMetric - Whether the current unit is metric (kg).
 * @param {Function} props.onSwitchChange - Callback invoked with the new isMetric boolean.
 */
export function UnitChooser({ isMetric, onSwitchChange }) {
  const { toast } = useToast();
  const buttonRef = useRef(null);
  const nextUnit = isMetric ? "lb" : "kg";

  const handleClick = () => {
    onSwitchChange(!isMetric);
    toast({
      title: `App units set to ${nextUnit}`,
      description: isMetric ? randomQuip(LB_QUIPS) : randomQuip(KG_QUIPS),
      duration: 4000,
    });

    const origin = getOriginFromRef(buttonRef);

    if (isMetric) {
      // Switching to lb — pick one emoji for this click, then advance the cycle
      const emoji = LB_EMOJIS[lbEmojiIndex % LB_EMOJIS.length];
      lbEmojiIndex++;
      import("canvas-confetti").then(({ default: confetti }) => {
        const shape = confetti.shapeFromText({ text: emoji, scalar: 3 });
        confetti({
          shapes: [shape],
          scalar: 3,
          particleCount: 10,
          spread: 30,
          startVelocity: 15,
          origin,
        });
      });
    } else {
      // Switching to kg — pick one emoji for this click, then advance the cycle
      const emoji = KG_EMOJIS[kgEmojiIndex % KG_EMOJIS.length];
      kgEmojiIndex++;
      import("canvas-confetti").then(({ default: confetti }) => {
        const shape = confetti.shapeFromText({ text: emoji, scalar: 3 });
        confetti({
          shapes: [shape],
          scalar: 3,
          particleCount: 10,
          spread: 30,
          startVelocity: 15,
          origin,
        });
      });
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={buttonRef}
            variant="outline"
            size="icon"
            aria-label={`Switch app units to ${nextUnit}`}
            onClick={handleClick}
          >
            {isMetric ? "kg" : "lb"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Switch app units to {nextUnit} — affects all charts and weights</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
