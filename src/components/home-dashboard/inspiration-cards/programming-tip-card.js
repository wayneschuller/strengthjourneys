import { Lightbulb } from "lucide-react";
import { useMemo } from "react";

import { InspirationCard } from "@/components/home-dashboard/inspiration-cards/inspiration-card";

const FIRST_WEEK_TIPS = [
  "Run the same basic lifts twice before changing anything dramatic.",
  "Keep the weights easy enough that your last rep still looks clean.",
  "A simple week beats an ambitious one you cannot repeat.",
  "Write down every set. The habit matters as much as the weight.",
];

const FIRST_MONTH_TIPS = [
  "Squat and press regularly, deadlift once a week, and leave a rep in reserve.",
  "If recovery feels rough, add consistency before adding load.",
  "Repeat lifts often enough that technique improves session to session.",
  "Let the logbook get boring before you try to make it impressive.",
];

export function ProgrammingTipCard({
  dashboardStage = "first_real_week",
  animationDelay = 0,
}) {
  const { title, footer } = useMemo(() => {
    const isFirstMonth = dashboardStage === "first_month";
    const tips = isFirstMonth ? FIRST_MONTH_TIPS : FIRST_WEEK_TIPS;
    const indexSeed = dashboardStage.length % tips.length;

    return {
      title: isFirstMonth ? "Build a repeatable month" : "Keep week one simple",
      footer: tips[indexSeed],
    };
  }, [dashboardStage]);

  return (
    <InspirationCard
      accent="amber"
      icon={Lightbulb}
      description="Programming Tip"
      title={title}
      footer={<span>{footer}</span>}
      footerMultiline
      animationDelay={animationDelay}
    />
  );
}
