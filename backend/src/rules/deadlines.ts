
export const RULES_LAST_CHECKED = "2026-11-09";


export const FALLBACK_RESPONSE_DAYS = 10;

export type DeadlineStatus = "overdue" | "critical" | "warning" | "ok";

export type DeadlineInfo = {
  dueAt: Date;
  source: "paypal" | "estimated";
  msLeft: number;
  daysLeft: number;
  hoursLeft: number;
  status: DeadlineStatus;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function validDate(d: Date | null | undefined): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export function computeDeadline(
  input: { responseDueAt: Date | null; openedAt: Date | null },
  now: Date = new Date()
): DeadlineInfo | null {
  let dueAt: Date;
  let source: "paypal" | "estimated";

  if (validDate(input.responseDueAt)) {
    dueAt = input.responseDueAt;
    source = "paypal";
  } else if (validDate(input.openedAt)) {
    dueAt = new Date(input.openedAt.getTime() + FALLBACK_RESPONSE_DAYS * DAY);
    source = "estimated";
  } else {
    return null;
  }

  const msLeft = dueAt.getTime() - now.getTime();

  let status: DeadlineStatus;
  if (msLeft <= 0) status = "overdue";
  else if (msLeft < DAY) status = "critical";
  else if (msLeft < 3 * DAY) status = "warning";
  else status = "ok";

  return {
    dueAt,
    source,
    msLeft,
    daysLeft: Math.max(0, Math.floor(msLeft / DAY)),
    hoursLeft: Math.max(0, Math.floor(msLeft / HOUR)),
    status,
  };
}