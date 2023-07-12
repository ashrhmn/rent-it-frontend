import useTimeout from "@/hooks/useTimeout";
import { DependencyList, useEffect } from "react";

const useDebounce = (
  callback: () => any,
  delay: number | undefined,
  dependencies: DependencyList
) => {
  const { clear, reset } = useTimeout(callback, delay);
  useEffect(reset, [...dependencies, reset]);
  useEffect(clear, [clear]);
};

export default useDebounce;
