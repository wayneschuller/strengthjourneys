"use client";

import { useState, useEffect } from "react";
import Head from "next/head";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
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

export default function StrengthLevelCalculator() {
  return (
    <div className="mx-4 md:mx-[5vw]">
      <Head>
        <title>E1RM Calculator (Strength Journeys)</title>
        <meta
          name="description"
          content="E1RM One Rep Max Calculator App (Strength Journeys)"
        />
      </Head>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Strength Level Calculator</CardTitle>
          <CardDescription>
            Estimate your strength level based on age, gender, and bodyweight.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input id="age" type="number" placeholder="Enter your age" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select id="gender">
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Bodyweight (lbs)</Label>
              <Input
                id="weight"
                type="number"
                placeholder="Enter your weight"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
