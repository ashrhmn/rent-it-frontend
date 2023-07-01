import {
  toast,
  Renderable,
  ValueOrFunction,
  DefaultToastOptions,
} from "react-hot-toast";

export const promiseToast = <T>(
  promise: Promise<T>,
  msgs?: {
    loading?: Renderable;
    success?: ValueOrFunction<Renderable, T>;
    error?: ValueOrFunction<Renderable, any>;
  },
  opts?: DefaultToastOptions
) => {
  const defaultMessage = { loading: null, success: null, error: null };
  const msgOptions = !msgs ? defaultMessage : { ...defaultMessage, ...msgs };

  const hideCss = { style: { display: "none" } };

  return toast.promise(promise, msgOptions, {
    ...opts,
    error: {
      ...(!!msgOptions.error ? opts?.error : { ...opts?.error, ...hideCss }),
    },
    success: {
      ...(!!msgOptions.success
        ? opts?.success
        : { ...opts?.success, ...hideCss }),
    },
    loading: {
      ...(!!msgOptions.loading
        ? opts?.loading
        : { ...opts?.loading, ...hideCss }),
    },
  });
};

export const NO_ERROR_TOAST = { error: { style: { display: "none" } } };
export const NO_SUCCESS_TOAST = { success: { style: { display: "none" } } };
export const TOAST_PROMISE_MESSAGES = {
  error: null,
  success: null,
  loading: null,
};
