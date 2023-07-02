import { ZodUtils } from "@/utils/zod.utils";
import toast from "react-hot-toast";
import { z } from "zod";

const badRequestExceptionMessageSchema = z.object({
  response: z.object({ data: z.object({ message: z.string() }) }),
});

const errorSchema = z.object({ message: z.string() });

export const hasBadRequestExceptionMessage = (
  error: any
): error is z.infer<typeof badRequestExceptionMessageSchema> => {
  return ZodUtils.followsSchema(error, badRequestExceptionMessageSchema);
};

export const hasErrorMessage = (
  error: any
): error is z.infer<typeof errorSchema> => {
  return ZodUtils.followsSchema(error, errorSchema);
};

const mapError = (error: string): string => {
  console.log("Parsed Error : ", error);
  if (
    error.includes("User denied transaction") ||
    error.includes("user rejected transaction")
  )
    return "You rejected the transaction";
  if (error === "Ownable: caller is not the owner")
    return "You are not authorized to perform this action";
  return error;
};

export const extractError = (error: unknown) => {
  console.log("Raw Error : ", error);
  if (typeof error === "string")
    error = (() => {
      try {
        return JSON.parse(error as any);
      } catch (error) {
        return error;
      }
    })();

  if (
    ZodUtils.followsSchema(
      error,
      z
        .object({
          extensions: z.object({
            originalError: z.object({
              message: z.string().array(),
            }),
          }),
        })
        .array()
    )
  ) {
    return error
      .map((e) => e.extensions.originalError.message.join("\n"))
      .join("\n");
  }

  if (
    ZodUtils.followsSchema(error, z.object({ message: z.string() }).array())
  ) {
    return error.map((e) => e.message).join("\n");
  } else if (hasBadRequestExceptionMessage(error))
    return mapError(error.response.data.message);
  else if (hasErrorMessage(error)) return mapError(error.message);
  else if (typeof error === "string") return mapError(error);
  else return "An unknown error occurred";
};

export const handleError = (error: unknown) => toast.error(extractError(error));
