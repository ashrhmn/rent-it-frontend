import Input from "@/components/common/Input";
import { tmutate } from "@/tgql";
import { handleError } from "@/utils/error.utils";
import { promiseToast } from "@/utils/toast.utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  surname: z.string().min(1, "Surname is required"),
  email: z.string().email(),
  phone: z.string().min(1, "Phone is required"),
  duration_in_months: z.coerce
    .number({ invalid_type_error: "Invalid Input" })
    .min(1, "Duration is required"),
});

type IFormData = z.infer<typeof formSchema>;

const SubmitTenantForm = () => {
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<IFormData>({
    resolver: zodResolver(formSchema),
  });
  const handleCreateFormSubmission = (data: IFormData) =>
    promiseToast(tmutate({ createTenantFormSubmission: [{ data }, true] }), {
      loading: "Submitting...",
      success: "Success",
    }).catch(handleError);

  return (
    <div>
      <h1 className="text-4xl font-bold my-2">Fill Tenant Info</h1>
      <form onSubmit={handleSubmit(handleCreateFormSubmission)}>
        <div className="flex flex-col md:flex-row gap-4 my-4">
          <Input
            label="Name"
            regProps={register("name")}
            error={errors.name?.message}
          />
          <Input
            label="Surname"
            regProps={register("surname")}
            error={errors.surname?.message}
          />
        </div>
        <div className="flex flex-col md:flex-row gap-4 my-4">
          <Input
            label="Tenant's Email"
            regProps={register("email")}
            error={errors.email?.message}
          />
          <Input
            label="Tenant's Phone"
            regProps={register("phone")}
            error={errors.phone?.message}
          />
        </div>
        <Input
          label="Tenancy Duration (in months)"
          regProps={register("duration_in_months")}
          error={errors.duration_in_months?.message}
        />
        <input
          type="submit"
          value={"Submit"}
          className="btn btn-primary mt-6"
        />
      </form>
    </div>
  );
};

export default SubmitTenantForm;
