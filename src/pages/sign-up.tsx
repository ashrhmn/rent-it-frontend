import Input from "@/components/common/Input";
import { tmutate } from "@/tgql";
import { getTimestampFromDateInputEvent } from "@/utils/date-time.utils";
import { handleError } from "@/utils/error.utils";
import { promiseToast } from "@/utils/toast.utils";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";

const signUpFormSchema = z
  .object({
    username: z
      .string()
      .min(1, "Username is required")
      .min(6, "Username must be at least 6 characters"),
    email: z.string().min(1, "Email is required").email(),
    password: z
      .string()
      .min(1, "Password is required")
      .min(8, "Username must be at least 8 characters"),
    confirmPassword: z.string(),
    dateOfBirth: z.number(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        path: ["confirmPassword"],
        message: "Passwords do not match",
        code: z.ZodIssueCode.custom,
      });
    }
    return {};
  });

type ISignUpFormData = z.infer<typeof signUpFormSchema>;

const SignUp = () => {
  const handleSignUp = async (data: ISignUpFormData) =>
    promiseToast(tmutate({ signUp: [{ data }, true] }), {
      loading: "Sign Up in progress...",
      success: "Successful!",
    }).catch(handleError);
  const {
    register,
    formState: { errors },
    handleSubmit,
    setValue,
  } = useForm<ISignUpFormData>({
    defaultValues: {
      dateOfBirth: 0,
      email: "",
      password: "",
      confirmPassword: "",
      username: "",
    },
    resolver: zodResolver(signUpFormSchema),
  });
  return (
    <div className="h-screen w-full flex justify-center items-center">
      <form
        className="p-3 bg-base-100 rounded-xl"
        onSubmit={handleSubmit(handleSignUp)}
      >
        <Input
          label="Username"
          regProps={register("username")}
          error={errors.username?.message}
        />
        <Input
          label="Email"
          regProps={register("email")}
          error={errors.email?.message}
        />
        <Input
          label="Password"
          regProps={register("password")}
          error={errors.password?.message}
          type="password"
        />
        <Input
          label="Confirm Password"
          regProps={register("confirmPassword")}
          error={errors.confirmPassword?.message}
          type="password"
        />
        <Input
          label="Date of Birth"
          error={errors.dateOfBirth?.message}
          type="date"
          otherProps={{
            onChange(event) {
              setValue("dateOfBirth", getTimestampFromDateInputEvent(event));
            },
          }}
        />
        <div className="join w-full mt-4">
          <Link href={"/login"} className="btn btn-secondary join-item w-1/2">
            Login
          </Link>
          <input
            className="btn btn-primary join-item w-1/2"
            type="submit"
            name="login"
            value={"Sign Up"}
          />
        </div>
      </form>
    </div>
  );
};

export default SignUp;
