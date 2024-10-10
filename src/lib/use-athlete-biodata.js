import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import {
  interpolateStandardKG,
  LiftingStandardsKG,
} from "@/lib/lifting-standards-kg";

import { useStateFromQueryOrLocalStorage } from "./use-state-from-query-or-localStorage";

// A custom hook to get and store the athlete provided bio data in localstorage
// Also provide some custom strength levels for the main lifts based on this bio data.
export const useAthleteBioData = () => {
  const [age, setAge] = useStateFromQueryOrLocalStorage("AthleteAge", 30);
  const [isMetric, setIsMetric] = useStateFromQueryOrLocalStorage(
    "calcIsMetric",
    false,
  );
  const [sex, setSex] = useStateFromQueryOrLocalStorage("AthleteSex", "male");
  const [bodyWeight, setBodyWeight] = useStateFromQueryOrLocalStorage(
    "AtheleteBodyWeight",
    200,
  );
  const [liftType, setLiftType] = useStateFromQueryOrLocalStorage(
    "AthleteLiftType",
    "Back Squat",
  );
  const [standards, setStandards] = useState({});

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

    setBodyWeight(newBodyWeight);
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
