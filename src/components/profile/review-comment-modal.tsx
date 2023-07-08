import { review_category } from "@/generated/zeus";
import { tmutate } from "@/tgql";
import { handleError } from "@/utils/error.utils";
import { clx } from "@/utils/jsx.utils";
import { promiseToast } from "@/utils/toast.utils";
import { useRouter } from "next/router";
import { useState } from "react";

const ReviewCommentModal = ({
  category,
  stars,
  comment,
  refetch,
}: {
  category: review_category;
  stars?: number;
  comment?: string;
  refetch: () => void;
}) => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : null;
  const handleAddStars = (
    category: review_category,
    stars: number | undefined,
    comment: string | undefined
  ) =>
    (async () => {
      if (!id) throw "Invalid Profile to review";
      promiseToast(
        tmutate({
          createReview: [
            { data: { category, profile_id: id, stars, comment } },
            true,
          ],
        }),
        {
          loading: "In Progress...",
          success: "Success!",
        }
      )
        .then(refetch)
        .catch(handleError);
    })().catch(handleError);
  const [updatedComment, setUpdatedComment] = useState(comment || "");
  return (
    <div>
      <label
        htmlFor={`review-comment-modal-${category}`}
        className="btn btn-sm btn-accent"
      >
        {!!comment || !!stars ? "Edit" : "Add"}
      </label>
      <input
        type="checkbox"
        id={`review-comment-modal-${category}`}
        className="modal-toggle"
      />
      <div className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">{category}</h3>
          <h4 className="font-bold text-lg">Stars : {stars || "Unrated"}</h4>
          {Array.from({ length: 5 }, (_, i) => (
            <button
              onClick={() => handleAddStars(category, i + 1, undefined)}
              className={clx("btn btn-sm", stars === i + 1 && "btn-disabled")}
              key={i}
            >
              {i + 1}
            </button>
          ))}
          <textarea
            placeholder="Add your comment here"
            className="w-full input input-primary my-4"
            value={updatedComment}
            onChange={(e) => setUpdatedComment(e.target.value)}
          ></textarea>

          <div className="modal-action">
            <button
              onClick={() =>
                handleAddStars(category, undefined, updatedComment)
              }
              className="btn btn-sm"
            >
              Update
            </button>
            <label
              htmlFor={`review-comment-modal-${category}`}
              className="btn btn-sm"
            >
              Close
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewCommentModal;
