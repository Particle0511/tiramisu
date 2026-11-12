import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

const Eye = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1.5 10s3-5.5 8.5-5.5S18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z" />
    <circle cx="10" cy="10" r="2.5" />
  </svg>
);

const EyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3l14 14M8.2 4.8A8.6 8.6 0 0110 4.5c5.5 0 8.5 5.5 8.5 5.5a14 14 0 01-2.6 3.1M5.6 6.3A14 14 0 001.5 10s3 5.5 8.5 5.5c1.3 0 2.5-.3 3.5-.8" />
    <path d="M8.4 8.4a2.5 2.5 0 003.2 3.2" />
  </svg>
);

export function PasswordInput(props: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="au-pw">
      <input {...props} className="au-input" type={show ? "text" : "password"} />
      <button
        type="button"
        className="au-eye"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}