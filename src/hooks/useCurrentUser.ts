import { tquery } from "@/tgql";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";

const useCurrentUser = () => {
  const router = useRouter();
  return useQuery(
    ["current-user", router.pathname],
    () =>
      tquery({
        currentUser: {
          email: true,
          id: true,
          permissions: true,
          username: true,
        },
      }),
    {
      retry: false,
      refetchInterval: 10000,
      keepPreviousData: false,
    }
  );
};

export default useCurrentUser;
