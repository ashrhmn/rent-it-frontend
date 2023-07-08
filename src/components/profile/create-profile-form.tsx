import Input from "@/components/common/Input";
import { profile_type } from "@/generated/zeus";
import { tmutate } from "@/tgql";
import { handleError } from "@/utils/error.utils";
import { promiseToast } from "@/utils/toast.utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((val) => (!!val ? val : undefined));

const createProfileFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  bio: optionalString,
  description: optionalString,
  property_city: optionalString,
  property_house_number: optionalString,
  property_postcode: optionalString,
  property_state: optionalString,
  property_street_address: optionalString,
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
      <h2 className="text-xl font-bold mt-8">
        Create profile as a {profileType}
      </h2>
      <form onSubmit={handleSubmit(handleCreateProfile)}>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 justify-center gap-2 items-start">
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
        </div>
        {profileType === profile_type.LANDLORD && (
          <>
            <h2 className="text-xl font-bold mt-8">Rental Details</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 justify-center gap-2 items-start">
              <Input
                label="Street Address"
                regProps={register("property_street_address")}
                error={errors.property_street_address?.message}
              />
              <Input
                label="House Number"
                regProps={register("property_house_number")}
                error={errors.property_house_number?.message}
              />
              <Input
                label="Postcode"
                regProps={register("property_postcode")}
                error={errors.property_postcode?.message}
              />
              <Input
                label="City"
                regProps={register("property_city")}
                error={errors.property_city?.message}
              />
              <Input
                label="State"
                regProps={register("property_state")}
                error={errors.property_state?.message}
              />
            </div>
          </>
        )}
        <button className="btn btn-primary mt-6" type="submit">
          Create Profile
        </button>
      </form>
    </div>
  );
};

export default CreateProfileForm;
