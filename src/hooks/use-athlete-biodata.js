import { useEffect, useState } from "react";
import {
  interpolateStandardKG,
  LiftingStandardsKG,
} from "@/lib/lifting-standards-kg";

import { useStateFromQueryOrLocalStorage } from "../lib/use-state-from-query-or-localStorage";

// A custom hook to get and store the athlete provided bio data in localStorage
// Also provide some custom strength levels for the main lifts based on this bio data.
// modifyURLQuery controls whether query parameters are updated (defaults to false)
export const useAthleteBioData = (modifyURLQuery = false) => {
  const [age, setAge] = useStateFromQueryOrLocalStorage(
    "AthleteAge",
    30,
    modifyURLQuery,
  );
  const [isMetric, setIsMetric] = useStateFromQueryOrLocalStorage(
    "calcIsMetric",
    false,
    modifyURLQuery,
  );
  const [sex, setSex] = useStateFromQueryOrLocalStorage(
    "AthleteSex",
    "male",
    modifyURLQuery,
  );
  const [bodyWeight, setBodyWeight] = useStateFromQueryOrLocalStorage(
    "AthleteBodyWeight",
    200,
    modifyURLQuery,
  );
  const [liftType, setLiftType] = useStateFromQueryOrLocalStorage(
    "AthleteLiftType",
    "Back Squat",
    modifyURLQuery,
  );
  const [standards, setStandards] = useState({});

  // FIXME: It may be better to convert the standards to lb in the component rather than in the state

  useEffect(() => {
    const bodyWeightKG = isMetric
      ? bodyWeight
      : Math.round(bodyWeight / 2.2046);

    const uniqueLiftNames = Array.from(
      new Set(LiftingStandardsKG.map((item) => item.liftType)),
    );
    const newStandards = {};

    uniqueLiftNames.forEach((liftType) => {
      const standard = interpolateStandardKG(
        age,
        bodyWeightKG,
        sex,
        liftType,
        LiftingStandardsKG,
      );

      if (isMetric) {
        newStandards[liftType] = standard || {};
      } else {
        newStandards[liftType] = {
          physicallyActive: Math.round(standard?.physicallyActive * 2.2046),
          beginner: Math.round(standard?.beginner * 2.2046),
          intermediate: Math.round(standard?.intermediate * 2.2046),
          advanced: Math.round(standard?.advanced * 2.2046),
          elite: Math.round(standard?.elite * 2.2046),
        };
      }
    });

    setStandards(newStandards);
  }, [age, sex, bodyWeight, isMetric]);

  // Helper function - if user toggles unit type, update isMetric and bodyweight state
  const toggleIsMetric = (isMetric) => {
    let newBodyWeight;

    if (!isMetric) {
      // Going from kg to lb
      newBodyWeight = Math.round(bodyWeight * 2.2046);
      setIsMetric(false);
    } else {
      // Going from lb to kg
      newBodyWeight = Math.round(bodyWeight / 2.2046);
      setIsMetric(true);
    }

    // Delay setting bodyWeight state by 100ms
    // This hack allows the query params to update the above isMetric value before we update other values
    // We have race conditions with router updates and useEffects - please don't judge me, this works
    setTimeout(() => {
      setBodyWeight(newBodyWeight);
    }, 100); // Adjust delay as needed
  };

  return {
    age,
    setAge,
    isMetric,
    setIsMetric,
    sex,
    setSex,
    bodyWeight,
    setBodyWeight,
    standards,
    toggleIsMetric,
    liftType,
    setLiftType,
  };
};
