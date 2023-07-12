import { profile_type } from "@/generated/zeus";
import { tquery } from "@/tgql";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/router";

const Dashboard = () => {
  const router = useRouter();
  const { data: tenantProfiles } = useQuery({
    queryKey: ["profiles-all", "tenants"],
    queryFn: () =>
      tquery({
        getProfiles: [
          { where: { type: { equals: profile_type.TENANT } } },
          { id: true, type: true, name: true },
        ],
      }).then(({ getProfiles }) => getProfiles),
    initialData: [],
  });
  const { data: landlordProfiles } = useQuery({
    queryKey: ["profiles-all", "landlords"],
    queryFn: () =>
      tquery({
        getProfiles: [
          { where: { type: { equals: profile_type.LANDLORD } } },
          { id: true, type: true, name: true },
        ],
      }).then(({ getProfiles }) => getProfiles),
    initialData: [],
  });
  return (
    <div>
      <h1 className="font-bold text-4xl my-4">All Profiles</h1>
      <div className="flex flex-col md:flex-row">
        <div className="w-1/2">
          <h1 className="font-bold text-2xl mb-5">Landlord Profiles</h1>
          <div className="grid md:grid-cols-2 gap-3">
            {landlordProfiles.map(({ id, name, type }) => (
              <Link
                className="grid bg-base-300/40 grid-cols-1 p-2 rounded-xl hover:bg-base-300 hover:scale-105 transition-all"
                href={`/profile/${id}`}
                key={id}
              >
                <span className="text-2xl font-bold">{name}</span>
                <span>{type}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="w-1/2">
          <h1 className="font-bold text-2xl mb-5">Tenant Profiles</h1>
          <div className="grid md:grid-cols-2 gap-3">
            {tenantProfiles.map(({ id, name, type }) => (
              <Link
                className="grid bg-base-300/40 grid-cols-1 p-2 rounded-xl hover:bg-base-300 hover:scale-105 transition-all"
                href={`/profile/${id}`}
                key={id}
              >
                <span className="text-2xl font-bold">{name}</span>
                <span>{type}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
