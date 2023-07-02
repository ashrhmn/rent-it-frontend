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
  const { isLoading, user } = useRouteData();
  if (isLoading) return <Loading />;
  return (
    <>
      <pre className="fixed opacity-40">{JSON.stringify(user, null, 2)}</pre>
      <>{children}</>
    </>
  );
};

const Loading = () => {
  return (
    <div className="h-screen w-full flex justify-center items-center">
      <h1>Loading...</h1>
    </div>
  );
};
