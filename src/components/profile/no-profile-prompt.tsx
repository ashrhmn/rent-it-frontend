import CreateProfileForm from "@/components/profile/create-profile-form";
import { profile_type } from "@/generated/zeus";
import { useState } from "react";

const NoProfilePrompt = () => {
  const [selectedProfileType, setSelectedProfileType] =
    useState<null | profile_type>(null);
  return (
    <div>
      <h1 className="text-center text-3xl font-bold">
        You have not created any profile yet, you must create a profile to
        continue using the application
      </h1>
      {!selectedProfileType && (
        <>
          <h2 className="text-xl font-bold text-center mt-6">
            Choose a Profile Type
          </h2>
          <div className="flex w-full justify-center mt-10 gap-10">
            <button
              onClick={() => setSelectedProfileType(profile_type.LANDLORD)}
              className="h-96 w-96 rounded-xl bg-base-200/40 hover:bg-base-300/40 transition-all"
            >
              <span className="text-4xl font-bold italic">I am a Landlord</span>
            </button>
            <button
              onClick={() => setSelectedProfileType(profile_type.TENANT)}
              className="h-96 w-96 rounded-xl bg-base-200/40 hover:bg-base-300/40 transition-all"
            >
              <span className="text-4xl font-bold italic">I am a Tenant</span>
            </button>
          </div>
        </>
      )}
      {!!selectedProfileType && (
        <CreateProfileForm profileType={selectedProfileType} />
      )}
    </div>
  );
};

export default NoProfilePrompt;
