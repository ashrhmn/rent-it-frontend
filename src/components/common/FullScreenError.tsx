import { extractError } from "@/utils/error.utils";

const FullScreenError = ({ error }: { error: unknown }) => {
  return (
    <div className="h-[90vh] w-full flex flex-col justify-center items-center">
      <h1 className="text-7xl font-bold">Error</h1>
      <h2 className="text-2xl font-bold">{extractError(error)}</h2>
    </div>
  );
};

export default FullScreenError;
