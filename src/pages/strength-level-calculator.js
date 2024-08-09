"use client";

import { useState, useEffect } from "react";
import Head from "next/head";
import { UnitChooser } from "@/components/unit-type-chooser";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { devLog } from "@/lib/processing-utils";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useLocalStorage } from "usehooks-ts";

// Strength Level Calculator
export default function StrengthLevelCalculator() {
  const [age, setAge] = useLocalStorage("SJ_AthleteAge", 30);
  const [isMetric, setIsMetric] = useLocalStorage("calcIsMetric", false, {
    initializeWithValue: false,
  });
  const [gender, setGender] = useLocalStorage("SJ_AthleteGender", "male");
  const [bodyWeight, setBodyWeight] = useLocalStorage(
    "SJ_AtheleteBodyWeight",
    200,
  );
  const [standards, setStandards] = useState({});

  useEffect(() => {
    const bodyWeightKG = isMetric
      ? bodyWeight
      : Math.round(bodyWeight / 2.2046);

    const standard = interpolateStandard(
      age,
      bodyWeightKG,
      gender,
      "Squat",
      LiftingStandardsKG,
    );

    devLog(standard);
    if (isMetric) {
      setStandards(standard || {});
    } else {
      // Convert standard to lb
      const standardLB = {
        physicallyActive: Math.round(standard.physicallyActive * 2.2046),
        beginner: Math.round(standard.beginner * 2.2046),
        intermediate: Math.round(standard.intermediate * 2.2046),
        advanced: Math.round(standard.advanced * 2.2046),
        elite: Math.round(standard.elite * 2.2046),
      };
      setStandards(standardLB || {});
    }
  }, [age, gender, bodyWeight, isMetric]);

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

  const unitType = isMetric ? "kg" : "lb";

  return (
    <div className="mx-4 flex flex-row items-center md:mx-[5vw]">
      <Head>
        <title>E1RM Calculator (Strength Journeys)</title>
        <meta
          name="description"
          content="E1RM One Rep Max Calculator App (Strength Journeys)"
        />
      </Head>

      <Card className="w-full max-w-5xl">
        <CardHeader>
          <CardTitle>Strength Level Calculator</CardTitle>
          <CardDescription>
            How strong am I? Estimate your strength level based on age, gender,
            and bodyweight.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row md:justify-stretch">
            <div className="flex items-center space-x-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                placeholder="Enter your age"
                className="w-20"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                id="gender"
                value={gender}
                onValueChange={(value) => setGender(value)}
                className="min-w-52"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="weight" className="">
                Bodyweight
              </Label>
              <Input
                id="weight"
                type="number"
                placeholder="Enter your weight"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                className="w-24"
              />
              <UnitChooser
                isMetric={isMetric}
                onSwitchChange={toggleIsMetric}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <div>
            <h2 className="font-bold">Squat Standards:</h2>
            <p>
              Physically Active: {standards.physicallyActive}
              {unitType}
            </p>
            <p>
              Beginner: {standards.beginner}
              {unitType}
            </p>
            <p>
              Intermediate: {standards.intermediate}
              {unitType}
            </p>
            <p>
              Advanced: {standards.advanced}
              {unitType}
            </p>
            <p>
              Elite: {standards.elite}
              {unitType}
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// Take the standards data and interpolate the standards for the given body weight
// FIXME: it needs to work when age or weight exceed the dataset
const interpolateStandard = (age, weight, gender, liftType, standards) => {
  devLog(
    `interpolateStandard. age: ${age}, weight: ${weight}, gender: ${gender}, liftType: ${liftType}`,
  );
  // Filter the dataset based on gender and liftType
  const filteredStandards = standards.filter(
    (item) => item.gender === gender && item.liftType === liftType,
  );

  if (filteredStandards.length === 0) return null; // Handle edge case

  // Sort the filtered dataset by age and bodyWeight
  filteredStandards.sort(
    (a, b) => a.age - b.age || a.bodyWeight - b.bodyWeight,
  );

  // Find the two closest points for age
  let ageLower, ageUpper;

  for (let i = 0; i < filteredStandards.length - 1; i++) {
    const current = filteredStandards[i];
    const next = filteredStandards[i + 1];

    if (age >= current.age && age <= next.age) {
      ageLower = current;
      ageUpper = next;
      break;
    }
  }

  if (!ageLower || !ageUpper) {
    devLog(`could not interpolate age`);
    return null; // Handle edge cases
  }

  devLog(`ageLower: ${ageLower.age}, ageUpper: ${ageUpper.age}`);

  // Interpolate between bodyweight values within the lower and upper age ranges
  const interpolateByBodyWeight = (agePoint) => {
    let weightLower, weightUpper;

    for (let i = 0; i < filteredStandards.length - 1; i++) {
      const current = filteredStandards[i];
      const next = filteredStandards[i + 1];

      if (
        current.age === agePoint &&
        weight >= current.bodyWeight &&
        weight <= next.bodyWeight
      ) {
        weightLower = current;
        weightUpper = next;
        break;
      }
    }

    if (!weightLower || !weightUpper) {
      devLog(
        `could not interpolate weight: weightLower: ${weightLower}, weightUpper: ${weightUpper}`,
      );
      return null; // Handle edge cases
    }

    const weightRatio =
      (weight - weightLower.bodyWeight) /
      (weightUpper.bodyWeight - weightLower.bodyWeight);
    return {
      physicallyActive: Math.round(
        weightLower.physicallyActive +
          (weightUpper.physicallyActive - weightLower.physicallyActive) *
            weightRatio,
      ),
      beginner: Math.round(
        weightLower.beginner +
          (weightUpper.beginner - weightLower.beginner) * weightRatio,
      ),
      intermediate: Math.round(
        weightLower.intermediate +
          (weightUpper.intermediate - weightLower.intermediate) * weightRatio,
      ),
      advanced: Math.round(
        weightLower.advanced +
          (weightUpper.advanced - weightLower.advanced) * weightRatio,
      ),
      elite: Math.round(
        weightLower.elite +
          (weightUpper.elite - weightLower.elite) * weightRatio,
      ),
    };
  };

  // Interpolate by bodyweight within the lower and upper age points
  const lowerValues = interpolateByBodyWeight(ageLower.age);
  const upperValues = interpolateByBodyWeight(ageUpper.age);

  if (!lowerValues || !upperValues) {
    devLog(
      `could not interpolate values: lowerValues: ${lowerValues}, upperValues: ${upperValues}`,
    );
    return null; // Handle edge cases
  }

  // Interpolate between the values obtained for lower and upper ages
  const ageRatio = (age - ageLower.age) / (ageUpper.age - ageLower.age);

  return {
    physicallyActive: Math.round(
      lowerValues.physicallyActive +
        (upperValues.physicallyActive - lowerValues.physicallyActive) *
          ageRatio,
    ),
    beginner: Math.round(
      lowerValues.beginner +
        (upperValues.beginner - lowerValues.beginner) * ageRatio,
    ),
    intermediate: Math.round(
      lowerValues.intermediate +
        (upperValues.intermediate - lowerValues.intermediate) * ageRatio,
    ),
    advanced: Math.round(
      lowerValues.advanced +
        (upperValues.advanced - lowerValues.advanced) * ageRatio,
    ),
    elite: Math.round(
      lowerValues.elite + (upperValues.elite - lowerValues.elite) * ageRatio,
    ),
  };
};

const interpolateStandardOLD = (weight, standards) => {
  // Sort the standards by bodyWeight
  standards.sort((a, b) => a.bodyWeight - b.bodyWeight);

  // Find the two nearest points in the standards data
  for (let i = 0; i < standards.length - 1; i++) {
    const low = standards[i];
    const high = standards[i + 1];

    if (weight >= low.bodyWeight && weight <= high.bodyWeight) {
      const ratio =
        (weight - low.bodyWeight) / (high.bodyWeight - low.bodyWeight);
      return {
        physicallyActive: Math.round(
          low.physicallyActive +
            ratio * (high.physicallyActive - low.physicallyActive),
        ),
        beginner: Math.round(
          low.beginner + ratio * (high.beginner - low.beginner),
        ),
        intermediate: Math.round(
          low.intermediate + ratio * (high.intermediate - low.intermediate),
        ),
        advanced: Math.round(
          low.advanced + ratio * (high.advanced - low.advanced),
        ),
        elite: Math.round(low.elite + ratio * (high.elite - low.elite)),
      };
    }
  }

  // If weight is out of range, return null or handle accordingly
  return null;
};

// Data for lifting standards is based on the research of Professor Lon Kilgore
// https://lonkilgore.com/
// Use the kg data and convert to elsewhere when needed
// prettier-ignore
const LiftingStandardsKG = [
  // Age 15-19 Squat Standards we mark as age 18 and interpolate
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 57, physicallyActive: 34, beginner: 59, intermediate: 78, advanced: 107, elite: 136, },
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 68, physicallyActive: 38, beginner: 65, intermediate: 87, advanced: 120, elite: 158, },
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 79, physicallyActive: 46, beginner: 80, intermediate: 106, advanced: 146, elite: 192, },
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 91, physicallyActive: 49, beginner: 85, intermediate: 113, advanced: 155, elite: 205, },
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 102, physicallyActive: 52, beginner: 89, intermediate: 118, advanced: 162, elite: 209, },
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 113, physicallyActive: 53, beginner: 90, intermediate: 120, advanced: 165, elite: 213, },
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 136, physicallyActive: 56, beginner: 97, intermediate: 129, advanced: 177, elite: 219, },
  // Age 80-89 Squat Standards we mark as age 85 and interpolate
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 57, physicallyActive: 18, beginner: 30, intermediate: 40, advanced: 55, elite: 73, },
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 68, physicallyActive: 24, beginner: 40, intermediate: 54, advanced: 74, elite: 97, },
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 79, physicallyActive: 26, beginner: 44, intermediate: 59, advanced: 81, elite: 107, },
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 91, physicallyActive: 27, beginner: 46, intermediate: 62, advanced: 85, elite: 112, },
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 102, physicallyActive: 28, beginner: 46, intermediate: 62, advanced: 86, elite: 113, },
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 113, physicallyActive: 28, beginner: 47, intermediate: 63, advanced: 87, elite: 115, },
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 136, physicallyActive: 28, beginner: 49, intermediate: 65, advanced: 89, elite: 117, },
];
