export type DisputeType =
  | "ITEM_NOT_RECEIVED"
  | "ITEM_NOT_AS_DESCRIBED"
  | "UNAUTHORIZED"
  | "OTHER";

export type EvidenceItem = {
  key: string;
  label: string;
  required: boolean;
  recordType: string; 
};


export const EVIDENCE_RULES: Record<DisputeType, EvidenceItem[]> = {
  ITEM_NOT_RECEIVED: [
    { key: "order", label: "Order details", required: true, recordType: "order" },
    { key: "payment", label: "Payment record", required: true, recordType: "payment" },
    { key: "tracking", label: "Shipment tracking number", required: true, recordType: "tracking" },
    { key: "delivery", label: "Delivery confirmation", required: true, recordType: "delivery_confirmation" },
    { key: "receipt", label: "Third-party shipping receipt", required: false, recordType: "shipping_receipt" },
    { key: "refund_proof", label: "Proof of any refund already given", required: false, recordType: "refund_proof" },
    { key: "address", label: "Shipping address matches order", required: false, recordType: "shipping_address" },
    { key: "messages", label: "Buyer communication", required: false, recordType: "buyer_message" },
  ],
  ITEM_NOT_AS_DESCRIBED: [
    { key: "order", label: "Order details", required: true, recordType: "order" },
    { key: "payment", label: "Payment record", required: true, recordType: "payment" },
    { key: "listing", label: "Item listing or description", required: true, recordType: "listing" },
    { key: "photos", label: "Photos of the item sent", required: false, recordType: "photos" },
    { key: "policy", label: "Return or refund policy", required: false, recordType: "refund_policy" },
    { key: "messages", label: "Buyer communication", required: false, recordType: "buyer_message" },
  ],
  UNAUTHORIZED: [
    { key: "order", label: "Order details", required: true, recordType: "order" },
    { key: "payment", label: "Payment record", required: true, recordType: "payment" },
    { key: "address", label: "Shipping address on the order", required: true, recordType: "shipping_address" },
    { key: "tracking", label: "Shipment tracking number", required: false, recordType: "tracking" },
    { key: "delivery", label: "Delivery confirmation", required: false, recordType: "delivery_confirmation" },
    { key: "messages", label: "Buyer communication", required: false, recordType: "buyer_message" },
  ],
  OTHER: [
    { key: "order", label: "Order details", required: true, recordType: "order" },
    { key: "payment", label: "Payment record", required: true, recordType: "payment" },
    { key: "messages", label: "Buyer communication", required: false, recordType: "buyer_message" },
  ],
};

export type ChecklistItem = EvidenceItem & { found: boolean };

export type Checklist = {
  items: ChecklistItem[];
  completenessPercent: number; 
  missingRequired: string[]; 
};

export function buildChecklist(
  type: DisputeType,
  foundRecordTypes: string[]
): Checklist {
  const found = new Set(foundRecordTypes);
  const items = EVIDENCE_RULES[type].map((item) => ({
    ...item,
    found: found.has(item.recordType),
  }));

  const required = items.filter((i) => i.required);
  const requiredFound = required.filter((i) => i.found).length;

  return {
    items,
    completenessPercent: required.length
      ? Math.round((requiredFound / required.length) * 100)
      : 0,
    missingRequired: required.filter((i) => !i.found).map((i) => i.label),
  };
}