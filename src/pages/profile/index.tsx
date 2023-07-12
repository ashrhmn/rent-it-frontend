import FullscreenLoading from "@/components/common/FullscreenLoading";
import ProfileView from "@/components/profile/profile-view";
import useCurrentUser from "@/hooks/useCurrentUser";
import { tquery } from "@/tgql";
import { useQuery } from "@tanstack/react-query";

const OwnProfile = () => {
  const { data } = useCurrentUser();
  const { data: profile, status } = useQuery({
    queryKey: ["user-profiles", data?.currentUser.id],
    queryFn: () =>
      tquery({
        getProfile: [
          { where: { user_id: { equals: data?.currentUser.id } } },
          {
            id: true,
            bio: true,
            description: true,
            name: true,
            type: true,
            property_city: true,
            property_house_number: true,
            property_postcode: true,
            property_state: true,
            property_street_address: true,
            user_id: true,
            user: { email: true },
          },
        ],
      }).then(({ getProfile }) => getProfile),
    enabled: !!data?.currentUser.id,
  });

  if (status !== "success") return <FullscreenLoading />;
  if (!profile) return <FullscreenLoading />;
  return <ProfileView profile={profile} viewerIsOwner />;
};

export default OwnProfile;
