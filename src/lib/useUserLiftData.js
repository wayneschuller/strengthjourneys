import useSWR from "swr";
import { useToast } from "@/components/ui/use-toast";

const fetcher = (...args) => fetch(...args).then((res) => res.json()); // Generic fetch for useSWR

function useUserLiftData(session, ssid) {
  const { toast } = useToast();
  let shouldFetch = session && ssid ? true : false;

  // console.log(`useUserLiftData hook: ssid is ${ssid}`);

  const { data, isLoading } = useSWR(
    shouldFetch ? `/api/readGSheet?ssid=${ssid}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

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
