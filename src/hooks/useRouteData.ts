import useCurrentUser from "@/hooks/useCurrentUser";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const useRouteData = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const { data, status } = useCurrentUser();

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
