/** @format */

"use client";

import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { ThemeProvider } from "@/components/theme-provider";
import { UnitChooser } from "../components/UnitChooser";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";

export default function Home() {
  const title = "Strength Journeys";

  return (
    <div>
      <Head>
        <title>{title}</title>
        {/* <link rel="icon" href="/favicon.ico" /> */}
        <meta
          name="description"
          content="A one rep max strength calculator you can use with chalked up hands on your phone in the middle of a gym session. 
                We give estimates using multiple exercise science formulas. Designed by lifters for lifters. 
                Useful for powerlifting, strong lifts, crossfit, starting strength and other programs."
        />

        <link rel="canonical" href="https://www.onerepmaxcalculator.xyz/" />
      </Head>
      <main className={`mt-4 flex justify-center `}>
        <h1 className="flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight lg:text-5xl ">
          Welcome to Strength Journeys 2.0
        </h1>
      </main>
      <Toaster />
    </div>
  );
}
