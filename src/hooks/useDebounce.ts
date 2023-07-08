import { DependencyList, useEffect } from "react";
import useTimeout from "./useTimeout";

const useDebounce = (
  callback: () => any,
  delay: number | undefined,
  dependencies: DependencyList,
) => {
  const { clear, reset } = useTimeout(callback, delay);
  useEffect(reset, [...dependencies, reset]);
  useEffect(clear, [clear]);
};

export default useDebounce;
