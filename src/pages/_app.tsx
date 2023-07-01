import "@/styles/globals.css";
import { tquery } from "@/tgql";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
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
  const router = useRouter();
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

  return (
    <>
      <pre className="fixed opacity-40">{JSON.stringify(data, null, 2)}</pre>
      <>{children}</>
    </>
  );
};

const Loading = () => {
  return <div>Loading...</div>;
};
