import useSWR from "swr";
import useSWRImmutable from "swr/immutable";

const fetcher = (...args) => fetch(...args).then((res) => res.json()); // Generic fetch for useSWR

function useUserLiftData(session, ssid) {
  let shouldFetch = session && ssid ? true : false; // Only fetch if we have session and ssid

  // FIXME: useSWRImmutable until we are ready to having in session data autoupdate live from gsheets
  const { data, isLoading } = useSWRImmutable(
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
