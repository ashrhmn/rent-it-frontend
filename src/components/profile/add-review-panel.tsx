import ReviewCommentModal from "@/components/profile/review-comment-modal";
import { tquery } from "@/tgql";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const AddReviewPanel = ({ profileId }: { profileId: string }) => {
  const queryClient = useQueryClient();
  const { data: reviewCategories } = useQuery({
    queryFn: () => tquery({ getReviewCategories: true }),
    queryKey: ["review-categories"],
  });

  const { data: reviewsByLoggedInUser, refetch: refetchReviews } = useQuery({
    queryFn: () =>
      tquery({
        getReviewsOnProfileByLoggedInUser: [
          { profile_id: profileId },
          { category: true, comment: true, stars: true, id: true },
        ],
      }).then((res) => res.getReviewsOnProfileByLoggedInUser),
    queryKey: ["reviews-by-logged-in-user", profileId],
  });

  const refetch = () => {
    refetchReviews();
    queryClient.invalidateQueries(["reviews-public", profileId]);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mt-8 mb-2">Add Reviews</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {reviewsByLoggedInUser?.map(({ id, category, stars, comment }) => (
          <div
            className="bg-base-300/40 p-2 rounded m-2 flex flex-col justify-between"
            key={id}
          >
            <div>
              <h2>{category}</h2>
              <h3>Stars : {stars || "Unrated"}</h3>
            </div>
            {!!comment && <p>Comment : {comment}</p>}
            <ReviewCommentModal
              category={category}
              stars={stars}
              comment={comment}
              refetch={refetch}
            />
          </div>
        ))}
        {reviewCategories?.getReviewCategories
          ?.filter(
            (category) =>
              !reviewsByLoggedInUser?.map((r) => r.category).includes(category)
          )
          .map((category) => (
            <div
              className="bg-base-300/40 p-2 rounded m-2 flex flex-col justify-between"
              key={category}
            >
              <div>
                <h2>{category}</h2>
                <h3>Stars : Unrated</h3>
              </div>
              <ReviewCommentModal
                category={category}
                stars={0}
                refetch={refetch}
              />
            </div>
          ))}
      </div>
    </div>
  );
};

export default AddReviewPanel;
