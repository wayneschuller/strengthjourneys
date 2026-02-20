/** @format */
"use client";

import * as React from "react";
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
  "🌍 Joined the rest of the world.",
  "🔬 Science approves.",
  "🌏 97% of the planet welcomes you.",
  "🧪 The metric system: because 10s are nice.",
  "🌍 Even the moon landings used metric internally.",
  "🏋️ IPF-legal units. Very official.",
  "🌎 Your European gym friends are proud.",
  "🔢 Base-10 superiority unlocked.",
  "🌍 Celsius users and kg users: kindred spirits.",
  "🧬 SI units. As nature intended.",
];

function randomQuip(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function UnitChooser({ isMetric, onSwitchChange }) {
  const { toast } = useToast();
  const nextUnit = isMetric ? "lb" : "kg";

  const handleClick = () => {
    onSwitchChange(!isMetric);
    toast({
      title: `App units set to ${nextUnit}`,
      description: isMetric ? randomQuip(LB_QUIPS) : randomQuip(KG_QUIPS),
      duration: 4000,
    });
    if (isMetric) {
      // Switching to lb — freedom units deserve fireworks
      import("canvas-confetti").then(({ default: confetti }) => {
        const flag = confetti.shapeFromText({ text: "🇺🇸", scalar: 2 });
        const burst = { shapes: [flag], scalar: 2, spread: 60, origin: { y: 0.6 } };
        confetti({ ...burst, particleCount: 20 });
        setTimeout(() => confetti({ ...burst, particleCount: 15, spread: 90, startVelocity: 35 }), 150);
        setTimeout(() => confetti({ ...burst, particleCount: 10, spread: 50, startVelocity: 45, origin: { x: 0.4, y: 0.65 } }), 280);
      });
    } else {
      // Switching to kg — a gentle globe shower
      import("canvas-confetti").then(({ default: confetti }) => {
        const globe = confetti.shapeFromText({ text: "🌍", scalar: 2 });
        confetti({ shapes: [globe], scalar: 2, particleCount: 18, spread: 80, origin: { y: 0.6 }, startVelocity: 28 });
      });
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
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
