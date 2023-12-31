import FullscreenLoading from "@/components/common/FullscreenLoading";
import NoProfilePrompt from "@/components/profile/no-profile-prompt";
import useCurrentUser from "@/hooks/useCurrentUser";
import { tmutate, tquery } from "@/tgql";
import { handleError } from "@/utils/error.utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";

const RootLayout = ({ children }: { children: ReactNode }) => {
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
  if (status === "loading") return <FullscreenLoading />;
  return (
    <div>
      <div className="">
        <div className="fixed left-0 right-0 bg-base-200">
          <nav className="flex navbar max-w-5xl mx-auto">
            <Link href={"/dashboard"} className="flex-1">
              Logo
            </Link>
            <div className="flex justify-end items-center">
              {status === "success" && (
                <div className="dropdown dropdown-end">
                  <label
                    tabIndex={0}
                    className="btn btn-ghost btn-circle avatar"
                  >
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
                      <Link href={"/profile"}>Profile</Link>
                    </li>
                    <li>
                      <a>Settings</a>
                    </li>
                    <li>
                      <a onClick={handleLogoutClick}>Logout</a>
                    </li>
                  </ul>
                </div>
              )}
              {status === "error" && (
                <>
                  <Link href={"/login"}>Login/Register</Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </div>

      {!!profiles &&
      !!profiles.getProfiles &&
      profiles.getProfiles.length === 0 ? (
        <div className="pt-20 max-w-5xl mx-auto px-8">
          <NoProfilePrompt />
        </div>
      ) : (
        <div className="pt-20 max-w-5xl mx-auto px-8">{children}</div>
      )}
    </div>
  );
};

export default RootLayout;
