import VerifiedIconSvg from "@/components/common/SVGs/verified-svg";
import AddReviewPanel from "@/components/profile/add-review-panel";
import OtherPeopleReviews from "@/components/profile/other-people-reviews";
import { profile_type } from "@/generated/zeus";
import Link from "next/link";

const ProfileView = ({
  profile,
  viewerIsOwner,
}: {
  profile: {
    id: string;
    bio?: string | undefined;
    description?: string | undefined;
    name: string;
    type: profile_type;
    property_city?: string | undefined;
    property_house_number?: string | undefined;
    property_postcode?: string | undefined;
    property_state?: string | undefined;
    property_street_address?: string | undefined;
    user_id: string;
    user: { email: string };
  };
  viewerIsOwner?: boolean;
}) => {
  return (
    <div>
      <div className="flex flex-col-reverse md:flex-row w-full">
        <div className="md:w-4/5">
          <h1 className="text-6xl font-bold my-4">{profile.name}</h1>
          <h2 className="font-bold text-xl my-2">{profile.type}</h2>
          {profile.bio && (
            <>
              <h3 className="font-bold">Bio</h3>
              <p>{profile.bio}</p>
            </>
          )}
          {profile.description && (
            <>
              <h3 className="font-bold">About Me</h3>
              <p>{profile.description}</p>
            </>
          )}
          <h3 className="flex items-center gap-2 mt-2">
            <span>
              <VerifiedIconSvg />
            </span>
            <span>Verified</span>
          </h3>
          <h3 className="mt-2 flex gap-2 items-center">
            <span>Email :</span>
            <a
              className="link-hover btn-link"
              href={`mailto:${profile.user.email}`}
            >
              {profile.user.email}
            </a>
          </h3>
        </div>
        <div className="rounded-full overflow-hidden md:w-1/5">
          <img
            className="h-40 w-40 rounded-full"
            src="https://png.pngitem.com/pimgs/s/146-1468281_profile-icon-png-transparent-profile-picture-icon-png.png"
            alt="user-image"
          />
        </div>
      </div>
      {!!viewerIsOwner && profile.type === profile_type.LANDLORD && (
        <Link className="link btn-link" href={`/submit-tenant-form`}>
          Submit Tenant Form
        </Link>
      )}
      {!viewerIsOwner && <AddReviewPanel profileId={profile.id} />}
      <OtherPeopleReviews profileId={profile.id} />
    </div>
  );
};

export default ProfileView;
