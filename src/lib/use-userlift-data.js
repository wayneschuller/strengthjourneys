"use client";

import { useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import useSWRImmutable from "swr/immutable";
import { useReadLocalStorage } from "usehooks-ts";
import { devLog } from "@/lib/processing-utils";

// const fetcher = (...args) => fetch(...args).then((res) => res.json()); // Generic fetch for useSWR

// Modified fetcher to include the access token in the headers
const fetcher = (url, token) =>
  fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      // "Content-Type": "application/json",
    },
  }).then((res) => res.json());

export function useUserLiftData2() {
  const ssid = useReadLocalStorage("ssid");
  const { data: session, status: authStatus } = useSession();

  const shouldFetch = session?.accessToken && ssid ? true : false; // Only fetch if we have auth and ssid

  const googleAPIKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  // const apiURL = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${googleAPIKey}`;
  const apiURL = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING`;
  const accessToken = session?.accessToken;

  devLog(shouldFetch && `Fetching with token ${accessToken}`);

  const { data, isLoading } = useSWR(
    shouldFetch ? [apiURL, accessToken] : null,
    (url, token) => fetcher(url, token),
    {},
  );

  return {
    data,
    isLoading,
    isError: data?.error ? true : false,
  };
}

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
