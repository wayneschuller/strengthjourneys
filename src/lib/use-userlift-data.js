"use client";

import { useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import useSWRImmutable from "swr/immutable";
import { useReadLocalStorage } from "usehooks-ts";
import { devLog } from "@/lib/processing-utils";

const fetcher = (...args) => fetch(...args).then((res) => res.json()); // Generic fetch for useSWR

export function useUserLiftData() {
  const ssid = useReadLocalStorage("ssid");
  const { status } = useSession();

  const shouldFetch = status === "authenticated" && ssid ? true : false; // Only fetch if we have auth and ssid

  const { data, isLoading } = useSWR(
    shouldFetch ? `/api/readGSheet?ssid=${ssid}` : null,
    fetcher,
    {
      // SWR options
      // Don't need any because the defaults are awesome
    },
  );

  return {
    data,
    isLoading,
    isError: data?.error ? true : false,
  };
}
