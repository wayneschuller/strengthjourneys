// A home dashboard for the top level of the site, shown only when user is logged in.
// This will also help with onboarding.

import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { SectionTopCards } from "./analyzer/section-top-cards";
import { useLocalStorage } from "usehooks-ts";
import useDrivePicker from "react-google-drive-picker";

export function HomeDashboard() {
  const { data: session, status: authStatus } = useSession();
  const [openPicker, authResponse] = useDrivePicker();

  const [ssid, setSsid] = useLocalStorage("ssid", null, {
    initializeWithValue: false,
  });

  const [sheetURL, setSheetURL] = useLocalStorage("sheetURL", null, {
    initializeWithValue: false,
  });
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
    { initializeWithValue: false },
  );

  const {
    parsedData,
    liftTypes,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();

  return (
    <div>
      <div className="text-xl">
        Welcome back <div className="inline font-bold">{session.user.name}</div>
      </div>
      {parsedData && <SectionTopCards />}
    </div>
  );
}
