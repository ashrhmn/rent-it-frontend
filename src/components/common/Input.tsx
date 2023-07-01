import { HTMLInputTypeAttribute } from "react";

const Input = ({
  inputProps,
  label,
  error,
  type = "text",
}: {
  label: string;
  inputProps: any;
  error?: string;
  type?: HTMLInputTypeAttribute;
}) => {
  return (
    <div className="form-control w-full max-w-xs">
      <label className="label">
        <span className="label-text">{label}</span>
      </label>
      <input
        type={type}
        className="input input-primary w-full max-w-xs"
        {...inputProps}
      />
      {!!error && <p className="text-error">{error}</p>}
    </div>
  );
};

export default Input;
