import { tquery } from "@/tgql";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const useRouteData = () => {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { data, status } = useQuery(
    ["current-user"],
    () =>
      tquery({
        currentUser: {
          email: true,
          id: true,
          permissions: true,
          username: true,
        },
      }),
    {}
  );

  useEffect(() => {
    if (redirectTo) router.push(redirectTo);
  }, [redirectTo, router]);

  useEffect(() => {
    if (router.pathname.startsWith("/login")) {
      if (status === "success") {
        setRedirectTo("/dashboard");
      } else {
        setIsLoading(false);
      }
    }
  }, [router.pathname, status]);

  useEffect(() => {
    if (router.pathname.startsWith("/dashboard")) {
      if (status === "success") {
        setRedirectTo("/");
      } else {
        setIsLoading(false);
      }
    }
  }, [router.pathname, status]);

  return {};
};

export default useRouteData;
