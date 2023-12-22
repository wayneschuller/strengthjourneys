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
  const { data: session, status: authStatus } = useSession();

  devLog(session);

  const shouldFetch = authStatus === "authenticated" && ssid ? true : false; // Only fetch if we have auth and ssid

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

// ----------------------------------------------------------------------------------------------------------
//
// FIXME: Some experimental code to try to get gsheet data from pure client without a Next.js API route
// FIXME: Could not get the token stuff to work yet.
// Modified fetcher to include the access token in the headers
//
// ----------------------------------------------------------------------------------------------------------
const fetcherWithToken = (url, token) =>
  fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      // "Content-Type": "application/json",
    },
  }).then((res) => res.json());

export function useUserLiftDataDirect() {
  const ssid = useReadLocalStorage("ssid");
  const { data: session, status: authStatus } = useSession();

  const shouldFetch = session?.accessToken && ssid ? true : false; // Only fetch if we have auth and ssid

  const googleAPIKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  // const apiURL = `https://sheets.googleapis.com/v3/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${googleAPIKey}`;
  const apiURL = `https://sheets.googleapis.com/v3/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING`;
  const accessToken = session?.accessToken;

  devLog(shouldFetch && `Fetching with token ${accessToken}`);

  const { data, isLoading } = useSWR(
    shouldFetch ? [apiURL, accessToken] : null,
    (url, token) => fetcherWithToken(url, token),
    {},
  );

  return {
    data,
    isLoading,
    isError: data?.error ? true : false,
  };
}
