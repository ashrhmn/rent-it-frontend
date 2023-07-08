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
    <div>
      <h1>Posts</h1>
    </div>
  );
};

export default Dashboard;
