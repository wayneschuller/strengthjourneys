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
//
// By design we will use lb behind the scenes and convert to kg for the UI if the user requests.
export default function StrengthLevelCalculator() {
  const [age, setAge] = useLocalStorage("SJ_AthleteAge", 30);
  const [gender, setGender] = useLocalStorage("SJ_AthleteGender", "male");
  const [bodyWeightUI, setBodyWeightUI] = useState(200);
  const [bodyWeight, setBodyWeight] = useLocalStorage(
    "SJ_AtheleteBodyWeightLB",
    200,
  );
  const [isMetric, setIsMetric] = useLocalStorage("calcIsMetric", false);
  const [standards, setStandards] = useState({});

  // Retrieve bodyweight from storage
  useEffect(() => {
    const storedBodyweightLB =
      parseFloat(localStorage.getItem("SJ_AtheleteBodyWeightLB")) || 0;

    if (isMetric) {
      setBodyWeightUI(storedBodyweightLB * 2.2046);
    } else {
      setBodyWeightUI(storedBodyweightLB);
    }
  }, []);

  useEffect(() => {
    devLog(`BodyweightUI: ${bodyWeight}`);

    const standard = interpolateStandard(bodyWeight, squatLiftingStandards);

    setStandards(standard || {});
  }, [bodyWeightUI]);

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
            Estimate your strength level based on age, gender, and bodyweight.
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
                value={bodyWeightUI * (isMetric ? 1 : 2.2046)}
                onChange={(e) => setBodyWeightUI(e.target.value)}
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
            <p>Physically Active: {standards.physicallyActive} kg</p>
            <p>Beginner: {standards.beginner} kg</p>
            <p>Intermediate: {standards.intermediate} kg</p>
            <p>Advanced: {standards.advanced} kg</p>
            <p>Elite: {standards.elite} kg</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// Take the standards data and interpolate the standards for the given body weight
const interpolateStandard = (weight, standards) => {
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

const squatLiftingStandards = [
  {
    age: 55,
    bodyWeight: 57,
    physicallyActive: 32,
    beginner: 55,
    intermediate: 73,
    advanced: 100,
    elite: 132,
  },
  {
    age: 55,
    bodyWeight: 68,
    physicallyActive: 37,
    beginner: 64,
    intermediate: 85,
    advanced: 117,
    elite: 154,
  },
  {
    age: 55,
    bodyWeight: 79,
    physicallyActive: 42,
    beginner: 71,
    intermediate: 95,
    advanced: 131,
    elite: 172,
  },
  {
    age: 55,
    bodyWeight: 91,
    physicallyActive: 46,
    beginner: 80,
    intermediate: 106,
    advanced: 146,
    elite: 192,
  },
  {
    age: 55,
    bodyWeight: 102,
    physicallyActive: 50,
    beginner: 86,
    intermediate: 114,
    advanced: 157,
    elite: 207,
  },
  {
    age: 55,
    bodyWeight: 113,
    physicallyActive: 53,
    beginner: 90,
    intermediate: 120,
    advanced: 165,
    elite: 218,
  },
  {
    age: 55,
    bodyWeight: 136,
    physicallyActive: 54,
    beginner: 93,
    intermediate: 124,
    advanced: 171,
    elite: 225,
  },
];
