import type { ReactNode } from "react";

export type IconName =
  | "overview" | "disputes" | "radar" | "evidence" | "approvals" | "activity" | "settings";

const PATHS: Record<IconName, ReactNode> = {
  overview: <path d="M4 16V9M10 16V4M16 16V12M2 17.5h16" />,
  disputes: <path d="M5 3h7l3 3v11H5zM12 3v3h3M8 10h4M8 13h4" />,
  radar: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 10l5-5" />
    </>
  ),
  evidence: <path d="M4 4h12v12H4zM7 8h6M7 11h6M7 14h3" />,
  approvals: <path d="M5 9h10v8H5zM7 9V6a3 3 0 016 0v3" />,
  activity: <path d="M2 10h4l2-5 4 10 2-5h4" />,
  settings: <path d="M3 6h14M3 14h14M7 4v4M13 12v4" />,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}