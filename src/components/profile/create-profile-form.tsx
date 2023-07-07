import Input from "@/components/common/Input";
import { profile_type } from "@/generated/zeus";
import { tmutate } from "@/tgql";
import { handleError } from "@/utils/error.utils";
import { promiseToast } from "@/utils/toast.utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { z } from "zod";

const createProfileFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  bio: z
    .string()
    .optional()
    .transform((val) => (!!val ? val : undefined)),
  description: z
    .string()
    .optional()
    .transform((val) => (!!val ? val : undefined)),
});

type IFormData = z.infer<typeof createProfileFormSchema>;

const CreateProfileForm = ({ profileType }: { profileType: profile_type }) => {
  const router = useRouter();
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<IFormData>({
    resolver: zodResolver(createProfileFormSchema),
  });
  const handleCreateProfile = (data: IFormData) =>
    promiseToast(
      tmutate({
        createProfile: [{ data: { ...data, type: profileType } }, true],
      }),
      { loading: "Creating Profile...", success: "Profile Created" }
    )
      .then(() => router.reload())
      .catch(handleError);
  return (
    <div>
      <form onSubmit={handleSubmit(handleCreateProfile)}>
        <Input
          label="Name"
          regProps={register("name")}
          error={errors.name?.message}
        />
        <Input
          label="Bio"
          regProps={register("bio")}
          error={errors.bio?.message}
        />
        <Input
          label="Description"
          regProps={register("description")}
          error={errors.description?.message}
        />
        <button className="btn btn-primary mt-6" type="submit">
          Create Profile
        </button>
      </form>
    </div>
  );
};

export default CreateProfileForm;
