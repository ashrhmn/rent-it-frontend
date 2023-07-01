export const createQuery = <
  T extends (..._args: Parameters<T>) => ReturnType<T>,
>(
  queryFn: T,
  key: string,
) => {
  return (...params: Parameters<T>) =>
    ({
      queryKey: [key, JSON.stringify(params)],
      queryFn: () => queryFn(...params),
    } as const);
};
