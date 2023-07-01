import Input from "@/components/common/Input";
import { tquery } from "@/tgql";
import { handleError } from "@/utils/error.utils";
import { promiseToast } from "@/utils/toast.utils";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";

const loginFormSchema = z.object({
  usernameOrEmail: z.string().min(1, "Username or Email is required"),
  password: z.string().min(1, "Password is required"),
});

type ILoginFormData = z.infer<typeof loginFormSchema>;

const Login = () => {
  const handleLogin = async (data: ILoginFormData) => {
    promiseToast(
      tquery({
        login: [{ data }, { accessToken: true, refreshToken: true }],
      }),
      {
        loading: "Logging in...",
        success: "Logged in!",
      }
    ).catch(handleError);
  };

  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<ILoginFormData>({
    defaultValues: {
      usernameOrEmail: "",
      password: "",
    },
    resolver: zodResolver(loginFormSchema),
  });

  return (
    <div className="h-screen w-full flex justify-center items-center">
      <form
        className="p-3 bg-base-100 rounded-xl"
        onSubmit={handleSubmit(handleLogin)}
      >
        <Input
          label="Username or Email"
          inputProps={register("usernameOrEmail")}
          error={errors.usernameOrEmail?.message}
        />
        <Input
          label="Password"
          inputProps={register("password")}
          error={errors.password?.message}
          type="password"
        />
        <div className="join w-full mt-4">
          <Link href={"/sign-up"} className="btn btn-secondary join-item w-1/2">
            Sign Up
          </Link>
          <input
            className="btn btn-primary join-item w-1/2"
            type="submit"
            name="login"
            value={"Login"}
          />
        </div>
      </form>
    </div>
  );
};

export default Login;
