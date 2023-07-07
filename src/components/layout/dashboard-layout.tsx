import FullscreenLoading from "@/components/common/FullscreenLoading";
import NoProfilePrompt from "@/components/profile/no-profile-prompt";
import useCurrentUser from "@/hooks/useCurrentUser";
import { tmutate, tquery } from "@/tgql";
import { handleError } from "@/utils/error.utils";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { ReactNode } from "react";

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const handleLogoutClick = () =>
    tmutate({ logout: true })
      .then(() => router.replace("/login"))
      .catch(handleError);
  const { data, status } = useCurrentUser();
  const { data: profiles } = useQuery({
    queryKey: ["user-profiles", data?.currentUser.id],
    queryFn: () =>
      tquery({
        getProfiles: [
          { where: { user_id: { equals: data?.currentUser.id } } },
          { id: true, type: true },
        ],
      }),
    enabled: !!data?.currentUser.id,
  });
  if (status !== "success") return <FullscreenLoading />;
  return (
    <>
      <div className="bg-base-200">
        <div className="fixed left-0 right-0">
          <nav className="flex navbar max-w-5xl mx-auto">
            <div className="flex-1"></div>
            <div className="flex justify-end items-center">
              <div className="dropdown dropdown-end">
                <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
                  <div className="w-10 rounded-full">
                    <img
                      src="https://png.pngitem.com/pimgs/s/146-1468281_profile-icon-png-transparent-profile-picture-icon-png.png"
                      alt="user-image"
                    />
                  </div>
                </label>
                <ul
                  tabIndex={0}
                  className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
                >
                  <li>
                    <a className="justify-between">
                      Profile
                      <span className="badge">New</span>
                    </a>
                  </li>
                  <li>
                    <a>Settings</a>
                  </li>
                  <li>
                    <a onClick={handleLogoutClick}>Logout</a>
                  </li>
                </ul>
              </div>
            </div>
          </nav>
        </div>
      </div>

      {!!profiles && profiles.getProfiles.length === 0 ? (
        <div className="pt-20 max-w-5xl mx-auto">
          <NoProfilePrompt />
        </div>
      ) : (
        <div className="pt-20 max-w-5xl mx-auto">{children}</div>
      )}
    </>
  );
};

export default DashboardLayout;
