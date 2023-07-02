import { tmutate } from "@/tgql";
import { handleError } from "@/utils/error.utils";
import { useRouter } from "next/router";

const Dashboard = () => {
  const router = useRouter();
  const handleLogoutClick = () =>
    tmutate({ logout: true })
      .then(() => router.replace("/login"))
      .catch(handleError);
  return (
    <div className="flex justify-end">
      <button onClick={handleLogoutClick} className="btn btn-warning">
        Logout
      </button>
    </div>
  );
};

export default Dashboard;
