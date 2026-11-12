import { ApiError } from "./api";
import { syncPaypal } from "./queries";

export type SyncOutcome = { ok: true; text: string } | { ok: false; text: string; link?: string };

// Runs a sync and turns every outcome into a plain message. It never throws.
export async function runSync(): Promise<SyncOutcome> {
  try {
    const r = await syncPaypal();
    let text = `Synced from the PayPal Sandbox. ${r.imported} imported, ${r.fetched} fetched.`;
    if (r.skippedOtherAccount > 0) {
      text += ` ${r.skippedOtherAccount} skipped because they belong to another workspace.`;
    }
    return { ok: true, text };
  } catch (e) {
    if (e instanceof ApiError && e.status === 403 && /connect your paypal/i.test(e.message)) {
      return { ok: false, text: "Connect your PayPal Sandbox in Settings before syncing.", link: "Connect PayPal" };
    }
    if (e instanceof ApiError && e.status === 422) {
      return { ok: false, text: "PayPal rejected your saved keys. Reconnect them in Settings.", link: "Reconnect" };
    }
    return { ok: false, text: (e as Error).message };
  }
}