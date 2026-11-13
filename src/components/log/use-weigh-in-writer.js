/**
 * Weigh-ins from anywhere outside the log: the bodyweight page, the
 * dashboard's nudge. It is the log's own sync (useLogSheetSync) bound to the
 * linked sheet, so a weigh-in written here is queued, kept offline and
 * checked against its row exactly like one written on the log.
 *
 * `weighInSeries` is the queue's view of every weigh-in: a new one is in it
 * the moment it is added, marked `pending` until the sheet has it.
 */
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useToast } from "@/hooks/use-toast";
import { formatDateToYmdLocal } from "@/lib/date-utils";
import { getSheetWriteColumns } from "@/lib/import/parsers/strength-journeys-parser";
import { useLogSheetSync } from "@/components/log/use-log-sheet-sync";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * @returns {{canWrite: boolean, todayIso: string|null, weighInSeries: Array,
 *   saveWeighIn: Function, deleteWeighIn: Function}}
 */
export function useWeighInWriter() {
  const { status: authStatus } = useSession();
  const {
    dataSource,
    hasLinkedSheet,
    sheetInfo,
    parsedData,
    parsedDataReadAt,
    sheetLayout,
    mutate,
  } = useUserLiftingData();
  const { isMetric, sex } = useAthleteBio();
  const { toast } = useToast();

  // The lifter's local date, set after mount so the server render agrees.
  const [todayIso, setTodayIso] = useState(null);
  useIsomorphicLayoutEffect(() => {
    setTodayIso(formatDateToYmdLocal(new Date()));
  }, []);

  const sheetColumns = useMemo(
    () => getSheetWriteColumns(sheetLayout),
    [sheetLayout],
  );
  // The same rule the log uses for which sheet the queue belongs to.
  const syncSsid =
    authStatus === "loading" ||
    dataSource === "loading" ||
    dataSource === "restoring"
      ? undefined
      : authStatus === "authenticated"
        ? (sheetInfo?.ssid ?? null)
        : null;

  const { saveWeighIn, deleteWeighIn, weighInSeries } = useLogSheetSync({
    ssid: syncSsid,
    canWrite: hasLinkedSheet,
    parsedData,
    parsedDataReadAt,
    sheetColumns,
    sessionDate: todayIso ?? "",
    isMetric,
    sex,
    mutate,
    toast,
  });

  return {
    canWrite: hasLinkedSheet && sheetColumns !== null && Boolean(todayIso),
    todayIso,
    weighInSeries,
    saveWeighIn,
    deleteWeighIn,
  };
}
