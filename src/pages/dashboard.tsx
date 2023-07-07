import DashboardLayout from "@/components/layout/dashboard-layout";
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
    <DashboardLayout>
      <h1>Posts</h1>
    </DashboardLayout>
  );
};

export default Dashboard;
