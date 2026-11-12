export type Deadline = {
  dueAt: string;
  source: "paypal" | "estimated";
  msLeft: number;
  daysLeft: number;
  hoursLeft: number;
  status: "overdue" | "critical" | "warning" | "ok";
};


export function formatMoney(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor === null || minor === undefined || !currency) return "Not available";
  const nf = new Intl.NumberFormat("en-US", { style: "currency", currency });
  const digits = nf.resolvedOptions().maximumFractionDigits ?? 2;
  return nf.format(minor / 10 ** digits);
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "Not available";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not available";
  return (withTime ? dateTimeFmt : dateFmt).format(d);
}

export function deadlineText(d: Deadline | null | undefined): string {
  if (!d) return "No response due";
  if (d.status === "overdue") return "Overdue";
  if (d.hoursLeft < 24) return `${d.hoursLeft}h left`;
  return `${d.daysLeft}d ${d.hoursLeft % 24}h left`;
}