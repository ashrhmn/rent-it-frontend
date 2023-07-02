import { tquery } from "@/tgql";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const useRouteData = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const { data, status } = useQuery(
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

  const isLoginSignUpRoute = useMemo(() => {
    if (["/login", "/sign-up"].some((path) => router.pathname.startsWith(path)))
      return true;
    return false;
  }, [router.pathname]);

  const isProtectedRoute = useMemo(() => {
    if (router.pathname.startsWith("/dashboard")) return true;
    return false;
  }, [router.pathname]);

  useEffect(() => {
    if (!isLoginSignUpRoute && !isProtectedRoute) setIsLoading(false);
    if (isLoginSignUpRoute) {
      if (status === "success") router.replace("/dashboard");
      if (status === "error") setIsLoading(false);
    }
    if (isProtectedRoute) {
      if (status === "error") router.replace("/login");
      if (status === "success") setIsLoading(false);
    }
  }, [isLoginSignUpRoute, isProtectedRoute, router, status]);

  return { isLoading, user: data?.currentUser };
};

export default useRouteData;
