import FullScreenError from "@/components/common/FullScreenError";
import FullscreenLoading from "@/components/common/FullscreenLoading";
import ProfileView from "@/components/profile/profile-view";
import useCurrentUser from "@/hooks/useCurrentUser";
import useDebounce from "@/hooks/useDebounce";
import NotFoundPage from "@/pages/404";
import { tquery } from "@/tgql";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useState } from "react";

const PublicProfile = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : null;
  const [isInvalidId, setIsInvalidId] = useState(false);
  useDebounce(
    () => {
      setIsInvalidId(!id);
    },
    1000,
    [id]
  );
  const {
    data: profile,
    status,
    error,
  } = useQuery({
    queryKey: ["user-profiles", id],
    queryFn: () =>
      tquery({
        getProfile: [
          { where: { id: { equals: id } } },
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
          },
        ],
      }).then(({ getProfile }) => getProfile),
    enabled: !!id,
    retry: false,
  });

  const { data: currentUser } = useCurrentUser();

  if (
    !!currentUser?.currentUser.id &&
    currentUser?.currentUser.id === profile?.user_id
  )
    router.replace("/profile");

  if (isInvalidId) return <NotFoundPage />;
  if (status === "loading") return <FullscreenLoading />;
  if (status === "error") return <FullScreenError error={error} />;
  return <ProfileView profile={profile} />;
};

export default PublicProfile;
