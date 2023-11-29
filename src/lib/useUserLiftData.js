import useSWR from "swr";

const fetcher = (...args) => fetch(...args).then((res) => res.json()); // Generic fetch for useSWR

function useUserLiftData(ssid) {
  console.log(`useUserLiftData hook: ssid is ${ssid}`);

  const { data, isLoading } = useSWR(`/api/readGSheet?ssid=${ssid}`, fetcher, {
    revalidateOnFocus: false,
  });

  // FIXME: can we parse the gsheet into our internal format here before returning to the user?
  console.log(`useUserLiftData hook. data is:`);
  console.log(data);

  return {
    data,
    isLoading,
    isError: data?.error ? true : false,
  };
}

export default useUserLiftData;
