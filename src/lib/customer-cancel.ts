export type CustomerCancelDecision = "cancel" | "paid" | "review" | "closed";

/** A customer may cancel only a payment that is still waiting. Confirmed money stays. */
export function customerCancelDecision(status: string): CustomerCancelDecision {
  if (status === "completed") return "paid";
  if (status === "needs_review") return "review";
  if (status === "pending") return "cancel";
  return "closed";
}
