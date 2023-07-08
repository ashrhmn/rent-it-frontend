import AddReviewPanel from "@/components/profile/add-review-panel";
import OtherPeopleReviews from "@/components/profile/other-people-reviews";
import { profile_type } from "@/generated/zeus";

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
  };
  viewerIsOwner?: boolean;
}) => {
  return (
    <div>
      <div className="flex w-full">
        <div className="w-4/5">
          <h1 className="text-6xl font-bold">{profile.name}</h1>
          <h2>{profile.type}</h2>
          {profile.bio && <p>{profile.bio}</p>}
          {profile.description && <p>{profile.description}</p>}
        </div>
        <div className="rounded-full overflow-hidden w-1/5">
          <img
            className="h-40 w-40 rounded-full"
            src="https://png.pngitem.com/pimgs/s/146-1468281_profile-icon-png-transparent-profile-picture-icon-png.png"
            alt="user-image"
          />
        </div>
      </div>
      {!viewerIsOwner && <AddReviewPanel profileId={profile.id} />}
      <OtherPeopleReviews profileId={profile.id} />
    </div>
  );
};

export default ProfileView;
