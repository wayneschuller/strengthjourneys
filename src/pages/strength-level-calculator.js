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
import { devLog } from "@/lib/processing-utils";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useLocalStorage } from "usehooks-ts";
import { LiftingStandardsKG } from "@/lib/lifting-standards-kg";
import { Separator } from "@/components/ui/separator";

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

    const uniqueLiftNames = Array.from(
      new Set(LiftingStandardsKG.map((item) => item.liftType)),
    );
    const newStandards = {};

    uniqueLiftNames.forEach((liftType) => {
      const standard = interpolateStandard(
        age,
        bodyWeightKG,
        gender,
        liftType,
        LiftingStandardsKG,
      );

      if (isMetric) {
        newStandards[liftType] = standard || {};
      } else {
        // Convert standard to lb
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

  const liftNames = Object.keys(standards);

  return (
    <div className="mx-4 flex flex-row items-center md:mx-[5vw]">
      <Head>
        <title>Free Strength Level Calculator (Strength Journeys)</title>
        <meta
          name="description"
          content="Free Strength Level Calculator Web App (Strength Journeys)"
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
              <Label htmlFor="age" className="text-xl">
                Age
              </Label>
              <Input
                id="age"
                type="number"
                placeholder="Enter your age"
                className="w-20 text-xl"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="gender" className="text-xl">
                Gender
              </Label>
              <Select
                id="gender"
                value={gender}
                onValueChange={(value) => setGender(value)}
                className="min-w-52 text-xl"
              >
                <SelectTrigger aria-label="Select gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="weight" className="text-xl">
                Bodyweight
              </Label>
              <Input
                id="weight"
                type="number"
                placeholder="Enter your weight"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                className="w-24 text-xl"
              />
              <UnitChooser
                isMetric={isMetric}
                onSwitchChange={toggleIsMetric}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {liftNames.map((liftType) => (
              <div key={liftType} className="">
                <h2 className="text-lg font-bold">{liftType} Standards:</h2>
                <div className="grid grid-cols-3 md:grid-cols-5">
                  <MiniCard
                    levelString="Physically Active"
                    weight={standards[liftType]?.physicallyActive}
                    unitType={unitType}
                  />
                  <MiniCard
                    levelString="Beginner"
                    weight={standards[liftType]?.beginner}
                    unitType={unitType}
                  />
                  <MiniCard
                    levelString="Intermediate"
                    weight={standards[liftType]?.intermediate}
                    unitType={unitType}
                  />
                  <MiniCard
                    levelString="Advanced"
                    weight={standards[liftType]?.advanced}
                    unitType={unitType}
                  />
                  <MiniCard
                    levelString="Elite"
                    weight={standards[liftType]?.elite}
                    unitType={unitType}
                  />
                </div>
                <Separator />
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="text-sm">
          <p className="">
            Our data model is a derivation of the excellent research of{" "}
            <a
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              target="_blank"
              href="https://lonkilgore.com/"
            >
              Professor Lon Kilgore
            </a>
            . Any errors are our own.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

const MiniCard = ({ levelString, weight, unitType }) => (
  <div className="flex-1 rounded-lg bg-card p-4">
    <h3 className="mb-2 text-sm font-medium">{levelString}</h3>
    <div className="text-2xl font-bold">
      {weight}
      {unitType}
    </div>
  </div>
);

// Take the standards data and interpolate the standards for the given body weight
// FIXME: it needs to work when age or weight exceed the dataset
const interpolateStandard = (age, weightKG, gender, liftType, standards) => {
  // devLog( `interpolateStandard. age: ${age}, weight: ${weight}, gender: ${gender}, liftType: ${liftType}`,);
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

  // devLog(`ageLower: ${ageLower.age}, ageUpper: ${ageUpper.age}`);

  // Interpolate between bodyweight values within the lower and upper age ranges
  const interpolateByBodyWeight = (agePoint) => {
    let weightLower, weightUpper;

    for (let i = 0; i < filteredStandards.length - 1; i++) {
      const current = filteredStandards[i];
      const next = filteredStandards[i + 1];

      if (
        current.age === agePoint &&
        weightKG >= current.bodyWeight &&
        weightKG <= next.bodyWeight
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
      (weightKG - weightLower.bodyWeight) /
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
    // devLog( `could not interpolate values: lowerValues: ${lowerValues}, upperValues: ${upperValues}`,);
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
