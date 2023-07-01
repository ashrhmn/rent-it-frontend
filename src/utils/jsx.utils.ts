import { HTMLAttributes } from "react";

type IClassName<T> = HTMLAttributes<T>["className"];

export const clx = <T>(...classes: Array<IClassName<T> | false>) => {
  return classes.filter(Boolean).join(" ");
};
