"use client";

import { useContext, useState, useEffect } from "react";
import { ParsedDataContext } from "@/pages/_app";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import useSWRImmutable from "swr/immutable";

const fetcher = (...args) => fetch(...args).then((res) => res.json()); // Generic fetch for useSWR

function useUserLiftData() {
  const {
    parsedData,
    setParsedData,
    ssid,
    setSsid,
    isDemoMode,
    setIsDemoMode,
    liftTypes,
    setLiftTypes,
    selectedLiftTypes,
    setSelectedLiftTypes,
  } = useContext(ParsedDataContext);
  const { data: session } = useSession();

  let shouldFetch = session && ssid ? true : false; // Only fetch if we have session and ssid

  // FIXME: set an interval for auto updating?

  const { data, isLoading } = useSWR(
    shouldFetch ? `/api/readGSheet?ssid=${ssid}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  // console.log(`useUserLiftData hook. data is:`);
  // console.log(data);

  return {
    data,
    isLoading,
    isError: data?.error ? true : false,
  };
}

export default useUserLiftData;
