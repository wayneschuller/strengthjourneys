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
  const { data: session } = useSession();

  const shouldFetch = session && ssid ? true : false; // Only fetch if we have session and ssid

  const { data, isLoading } = useSWR(
    shouldFetch ? `/api/readGSheet?ssid=${ssid}` : null,
    fetcher,
    {
      // SWR options
      // Don't need any because the defaults are awesome
    },
  );

  // Let session warm up
  // Return fake SWR results with isLoading until next-auth is fully initialized
  // If there is no login then session will become null and we can just rely on the SWR results
  // FIXME: use the session status
  if (session === undefined)
    return { data: undefined, isLoading: true, isError: false };

  return {
    data,
    isLoading,
    isError: data?.error ? true : false,
  };
}
