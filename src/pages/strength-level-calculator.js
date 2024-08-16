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

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useLocalStorage } from "usehooks-ts";
import {
  interpolateStandard,
  LiftingStandardsKG,
} from "@/lib/lifting-standards-kg";
import { Separator } from "@/components/ui/separator";

// Strength Level Calculator
export default function StrengthLevelCalculator() {
  const [age, setAge] = useLocalStorage("AthleteAge", 30);
  const [isMetric, setIsMetric] = useLocalStorage("calcIsMetric", false, {
    initializeWithValue: false,
  });
  const [sex, setSex] = useLocalStorage("AthleteSex", "male");
  const [bodyWeight, setBodyWeight] = useLocalStorage(
    "AtheleteBodyWeight",
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
        sex,
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
  }, [age, sex, bodyWeight, isMetric]);

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
    <div className="mx-4 flex flex-row items-center md:mx-[10vw] xl:mx-[20vw]">
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
            <Label htmlFor="age" className="text-xl">
              Age: {age}
            </Label>
            <Slider
              min={13}
              max={100}
              step={1}
              value={[age]}
              onValueChange={(values) => setAge(values[0])}
              className="mt-2 flex-1"
            />
            <div className="flex items-center space-x-2">
              <Label htmlFor="gender" className="text-xl">
                Gender
              </Label>
              <Select
                id="gender"
                value={sex}
                onValueChange={(value) => setSex(value)}
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
                Bodyweight: {bodyWeight}
              </Label>
              <UnitChooser
                isMetric={isMetric}
                onSwitchChange={toggleIsMetric}
              />
              <Slider
                min={isMetric ? 40 : 100}
                max={isMetric ? 230 : 500}
                step={1}
                value={[bodyWeight]}
                onValueChange={(values) => setBodyWeight(values[0])}
                className="mt-2 min-w-40 flex-1"
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
