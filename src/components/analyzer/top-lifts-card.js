import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TopLiftsTable } from "@/components/analyzer/lift-frequency-pie-card";

/**
 * Card containing only the top-lifts table (top 20 by set count).
 * Controlled — caller manages which lift is selected.
 *
 * @param {Object} props
 * @param {string|null} props.selectedLiftType - Currently selected lift type.
 * @param {function} props.onSelectLift - Called with a liftType string on row click.
 */
export function TopLiftsCard({ selectedLiftType, onSelectLift }) {
  const { liftTypes } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const { getColor } = useLiftColors();

  if (!liftTypes || liftTypes.length < 1) return null;

  const tableLifts = liftTypes;
  const liftColors = {};
  tableLifts.forEach((item) => {
    liftColors[item.liftType] = getColor(item.liftType);
  });

  const totalSets = liftTypes.reduce((sum, item) => sum + item.totalSets, 0);
  const stats = tableLifts.map((item) => ({
    liftType: item.liftType,
    sets: item.totalSets,
    reps: item.totalReps,
    color: liftColors[item.liftType],
    percentage: ((item.totalSets / totalSets) * 100).toFixed(1),
  }));

  return (
    <Card className="flex max-h-[60vh] flex-col">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo mode: "}Your Lifts
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <TopLiftsTable
          stats={stats}
          selectedLiftType={selectedLiftType}
          onSelectLift={onSelectLift}
        />
      </CardContent>
    </Card>
  );
}
