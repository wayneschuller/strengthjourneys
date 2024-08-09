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
import { e1rmFormulae } from "@/lib/estimate-e1rm";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
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

export default function StrengthLevelCalculator() {
  const [age, setAge] = useLocalStorage("SJ_AthleteAge", 30);
  const [gender, setGender] = useLocalStorage("SJ_AthleteGender", "male");
  const [bodyWeight, setBodyWeight] = useLocalStorage("SJ_AthleteWeight", 200);
  const [isMetric, setIsMetric] = useLocalStorage("calcIsMetric", false);

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
      </Card>
    </div>
  );
}
