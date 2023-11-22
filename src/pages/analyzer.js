import Head from "next/head";
import React, { useState, useEffect } from "react";

import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const Analyzer = () => {
  const [time, setTime] = useState(1);

  return (
    <>
      <Head>
        <title>PR Analyzer (Strength Journeys)</title>
        <meta name="description" content="Strength Journeys Lift PR Analyzer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main
        className={`flex flex-col items-center justify-between pt-4 ${inter.className}`}
      >
        <h1 className="flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight lg:text-5xl ">
          PR Analyzer
        </h1>
      </main>
    </>
  );
};
export default Analyzer;
