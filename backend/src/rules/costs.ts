import type { DeadlineStatus } from "./deadlines";

export type CostInput = {
  amountMinor: number; // disputed amount, whole minor units (8500 = 85.00)
  currency: string;
  goodsCostMinor?: number; // what the goods cost the seller. Default 0.
  disputeFeeMinor?: number; // any dispute fee the seller expects to pay. Default 0.
  partialRefundMinor?: number; // optional partial refund the seller is considering
  deadlineStatus: DeadlineStatus;
  evidenceCompletenessPercent: number;
};

export type CostOption = {
  key: "refund_full" | "refund_partial" | "accept" | "contest";
  label: string;
  available: boolean;
  bestCaseLossMinor: number;
  worstCaseLossMinor: number;
  note: string;
};

export type CostComparison = {
  currency: string;
  options: CostOption[];
  evidenceCompletenessPercent: number;
  assumptions: string[];
};

function mustBeMinor(name: string, v: number) {
  if (!Number.isInteger(v) || v < 0) {
    throw new Error(`${name} must be a non-negative whole number`);
  }
}

export function compareOptions(input: CostInput): CostComparison {
  const goods = input.goodsCostMinor ?? 0;
  const fee = input.disputeFeeMinor ?? 0;
  const partial = input.partialRefundMinor;

  mustBeMinor("amountMinor", input.amountMinor);
  mustBeMinor("goodsCostMinor", goods);
  mustBeMinor("disputeFeeMinor", fee);
  if (partial !== undefined) {
    mustBeMinor("partialRefundMinor", partial);
    if (partial > input.amountMinor) {
      throw new Error("partialRefundMinor cannot exceed amountMinor");
    }
  }

  const fullLoss = input.amountMinor + goods;
  const lossWithFee = fullLoss + fee;
  const overdue = input.deadlineStatus === "overdue";

  const options: CostOption[] = [
    {
      key: "refund_full",
      label: "Refund in full",
      available: true,
      bestCaseLossMinor: fullLoss,
      worstCaseLossMinor: fullLoss,
      note: "Ends the dispute on your terms. The loss is certain.",
    },
  ];

  if (partial !== undefined && partial > 0 && partial < input.amountMinor) {
    options.push({
      key: "refund_partial",
      label: "Offer a partial refund",
      available: true,
      bestCaseLossMinor: partial,
      worstCaseLossMinor: lossWithFee,
      note: "If the buyer accepts, you lose only the partial amount. If not, the dispute can continue and the full loss applies.",
    });
  }

  options.push(
    {
      key: "accept",
      label: "Accept the dispute",
      available: true,
      bestCaseLossMinor: lossWithFee,
      worstCaseLossMinor: lossWithFee,
      note: "The buyer is refunded. The loss is certain.",
    },
    {
      key: "contest",
      label: "Contest with evidence",
      available: !overdue,
      bestCaseLossMinor: 0,
      worstCaseLossMinor: lossWithFee,
      note: overdue
        ? "The response deadline has passed, so contesting is not available."
        : "Best case you keep the money. Worst case you lose the same as accepting. This tool does not predict which will happen.",
    }
  );

  return {
    currency: input.currency,
    options,
    evidenceCompletenessPercent: input.evidenceCompletenessPercent,
    assumptions: [
      "All figures are estimates from the inputs shown, not PayPal's final numbers.",
      "Loss means money lost compared with a completed sale.",
      "Fees are included only if you entered a dispute fee. Check PayPal's current fee schedule.",
      "Evidence completeness is the share of required items found. It is not a chance of winning.",
    ],
  };
}