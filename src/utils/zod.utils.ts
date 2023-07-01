import { z } from "zod";

const followsSchema = <T extends z.ZodTypeAny>(
  value: any,
  schema: T
): value is z.infer<T> => schema.safeParse(value).success;

export const ZodUtils = { followsSchema };
