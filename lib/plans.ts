export const PREMIUM_PLAN = {
  id: "premium",
  name: "Premium",
  priceCents: 5000,
  price: "50.00",
  cycle: "MONTHLY"
} as const;

export type BillingType = "CREDIT_CARD" | "PIX" | "BOLETO";
