import { useState, type FormEvent } from "react";
import { formatMoney } from "../lib/format";
import { currencyDigits, fromMinorText, toMinor } from "../lib/money";

export function RefundForm({
  amountMinor,
  currency,
  busy,
  onPrepare,
}: {
  amountMinor: number;
  currency: string;
  busy: boolean;
  onPrepare: (amountMinor: number) => void;
}) {
  const full = fromMinorText(amountMinor, currency);
  const [text, setText] = useState(full);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const minor = toMinor(text, currencyDigits(currency));
    if (minor === null || minor <= 0) return setError(`Enter an amount greater than zero, like ${full}.`);
    if (minor > amountMinor) {
      return setError(`The offer cannot be more than the disputed amount, ${formatMoney(amountMinor, currency)}.`);
    }
    onPrepare(minor);
  }

  return (
    <form onSubmit={submit} className="ap-form" style={{ marginTop: 14 }}>
      <div className="ap-field">
        <label htmlFor="refund-amount">Offer amount</label>
        <div className="ap-input-row">
          <input
            id="refund-amount"
            className="ap-input"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <span className="ap-cur">{currency}</span>
        </div>
        {error && <p className="ap-error-text" role="alert">{error}</p>}
      </div>
      <button className="ap-btn dark" type="submit" disabled={busy}>
        {busy ? "Preparing" : "Prepare refund offer"}
      </button>
    </form>
  );
}