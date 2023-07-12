import { tquery } from "@/tgql";
import { extractError } from "@/utils/error.utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

const OtherPeopleReviews = ({ profileId }: { profileId: string }) => {
  const { data, status, error } = useQuery({
    queryFn: () =>
      tquery({
        getAllReviewsByProfileId: [
          { profile_id: profileId },
          {
            id: true,
            name: true,
            sent_reviews: { category: true, comment: true, stars: true },
          },
        ],
      }).then((res) => res.getAllReviewsByProfileId),
    queryKey: ["reviews-public", profileId],
  });
  if (status === "error") return <p>{extractError(error)}</p>;
  return (
    <div className="my-8">
      <h2 className="text-xl font-bold mb-2">All Reviews</h2>
      {status === "success" && (
        <>
          {data.map(({ id, name, sent_reviews }) => (
            <div className="bg-base-300/40 rounded p-2" key={id}>
              <Link
                href={`/profile/${id}`}
                className="font-bold text-lg link-hover"
              >
                {name}
              </Link>
              <div className="flex flex-wrap gap-3">
                {sent_reviews.map(({ category, comment, stars }) => (
                  <div className="bg-neutral/10 p-2 rounded-xl" key={category}>
                    <h4>{category}</h4>
                    <h5>Stars : {stars || "Unrated"}</h5>
                    {!!comment && <p>Comment : {comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {data.length === 0 && <p>No reviews yet</p>}
        </>
      )}
    </div>
  );
};

export default OtherPeopleReviews;
