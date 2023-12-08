"use client";

import { useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import useSWRImmutable from "swr/immutable";
import { useReadLocalStorage } from "usehooks-ts";
import { devLog } from "./SJ-utils";

const fetcher = (...args) => fetch(...args).then((res) => res.json()); // Generic fetch for useSWR

function useUserLiftData() {
  const ssid = useReadLocalStorage("ssid");
  const { data: session } = useSession();

  const shouldFetch = session && ssid ? true : false; // Only fetch if we have session and ssid

  // FIXME: set an interval for auto updating?
  const { data, isLoading } = useSWR(
    shouldFetch ? `/api/readGSheet?ssid=${ssid}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  devLog(`session:`);
  devLog(session);
  devLog(`data:`);
  devLog(data);
  devLog(
    `isLoading: ${session === undefined ? true : isLoading}, ssid: ${ssid}`,
  );

  if (session === undefined)
    return { data: undefined, isLoading: true, isError: false }; // Let session warm up

  return {
    data,
    isLoading,
    isError: data?.error ? true : false,
  };
}

export default useUserLiftData;
