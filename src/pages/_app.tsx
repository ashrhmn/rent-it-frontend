import FullscreenLoading from "@/components/common/FullscreenLoading";
import RootLayout from "@/components/layout/root-layout";
import useRouteData from "@/hooks/useRouteData";
import "@/styles/globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppProps } from "next/app";
import { ReactNode } from "react";
import { Toaster } from "react-hot-toast";

export default function App({ Component, pageProps }: AppProps) {
  const client = new QueryClient();
  return (
    <>
      <QueryClientProvider client={client}>
        <Wrapper>
          <Component {...pageProps} />
          <Toaster position="top-right" />
        </Wrapper>
      </QueryClientProvider>
    </>
  );
}

const Wrapper = ({ children }: { children: ReactNode }) => {
  const { isLoading, isLoginSignUpRoute } = useRouteData();
  // useEffect(() => {
  //   document.documentElement.setAttribute(
  //     "data-theme",
  //     localStorage.getItem("theme") || "cmyk"
  //   );
  // }, []);
  if (isLoading) return <FullscreenLoading />;
  if (isLoginSignUpRoute) return <div>{children}</div>;
  return (
    <RootLayout>
      <div>{children}</div>
    </RootLayout>
  );
};
