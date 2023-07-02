import { HTMLInputTypeAttribute, InputHTMLAttributes } from "react";

const Input = ({
  regProps,
  label,
  error,
  type = "text",
  otherProps,
}: {
  label: string;
  error?: string;
  type?: HTMLInputTypeAttribute;
  regProps?: any;
  otherProps?: InputHTMLAttributes<HTMLInputElement>;
}) => {
  return (
    <div className="form-control w-full max-w-xs">
      <label className="label">
        <span className="label-text">{label}</span>
      </label>
      <input
        type={type}
        className="input input-primary w-full max-w-xs"
        {...regProps}
        {...otherProps}
      />
      {!!error && <p className="text-error">{error}</p>}
    </div>
  );
};

export default Input;
