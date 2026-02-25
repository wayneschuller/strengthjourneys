import { Anvil } from "lucide-react";
import { useMemo } from "react";

import {
  calculateLifetimeTonnageFromLookup,
  formatLifetimeTonnage,
} from "@/lib/home-dashboard/inspiration-card-metrics";
import { InspirationCard } from "./inspiration-card";

export function LifetimeTonnageCard({
  sessionTonnageLookup,
  isMetric,
  animationDelay = 0,
}) {
  const lifetimeTonnage = useMemo(
    () =>
      calculateLifetimeTonnageFromLookup(sessionTonnageLookup, isMetric ? "kg" : "lb"),
    [sessionTonnageLookup, isMetric],
  );

  return (
    <InspirationCard
      accent="violet"
      icon={Anvil}
      description="Lifetime Tonnage"
      title={
        lifetimeTonnage.primaryTotal > 0
          ? `${formatLifetimeTonnage(lifetimeTonnage.primaryTotal)} ${lifetimeTonnage.primaryUnit} moved`
          : "No lifting logged yet"
      }
      footer={
        lifetimeTonnage.primaryTotal > 0 ? (
          <span>
            {lifetimeTonnage.sessionCount.toLocaleString()} sessions · avg{" "}
            {formatLifetimeTonnage(lifetimeTonnage.averagePerSession)}{" "}
            {lifetimeTonnage.primaryUnit}/session
          </span>
        ) : null
      }
      animationDelay={animationDelay}
    />
  );
}
