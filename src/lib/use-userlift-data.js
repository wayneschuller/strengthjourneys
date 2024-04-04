"use client";

import { useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import useSWRImmutable from "swr/immutable";
import { useReadLocalStorage } from "usehooks-ts";
import { devLog } from "@/lib/processing-utils";

// ----------------------------------------------------------------------------------------------------------
// Some code to get gsheet data from pure client without a Next.js API route
// Modified fetcher to include the access token in the headers
// ----------------------------------------------------------------------------------------------------------
async function fetcherWithToken(url, token) {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // This will capture HTTP errors such as 401, 403, 404, etc.
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Here, we catch both network errors and the errors thrown above for HTTP status checks
    throw error;
  }
}

export function useUserLiftData() {
  const ssid = useReadLocalStorage("ssid");
  const { data: session, status: authStatus } = useSession();

  devLog(`useUserLiftData authStatus: ${authStatus}`);

  const shouldFetch = !!session?.accessToken && !!ssid;

  const accessToken = session?.accessToken;

  // Note: Don't put key or tokens in URI
  const apiURL = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A:Z?dateTimeRenderOption=FORMATTED_STRING`;

  const { data, error, isLoading } = useSWR(
    shouldFetch ? apiURL : null,
    (url) => fetcherWithToken(url, accessToken), // Directly pass accessToken here
  );

  // if (error) devLog(`Local fetch to GSheet servers error: ${error}`);

  return {
    data,
    isLoading,
    isError: !!error, // FIXME: there is some edge case where this wrongly returns true
  };
}
