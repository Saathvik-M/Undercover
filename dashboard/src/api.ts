export type Status =
  "waiting" | "in_progress" | "waiting_for_signoff" | "decided";

export type Decision = "approve" | "decline" | "refer";

export interface DecisionSummary {
  decision: Decision;
  payout: number;
}

export interface QueueClaim {
  claim_id: string;
  customer_name: string;
  claim_type: string;
  amount_claimed: number;
  status: Status;
  decision: DecisionSummary | null;
}

export interface Handler {
  handler_id: string;
  name: string;
  role: string;
  email: string;
}

export interface ClaimItem {
  description: string;
  category: string;
  amount: number;
}

export interface ClaimDocument {
  name: string;
  type: string;
  content: string;
}

export interface Trip {
  destination: string;
  departs_on: string;
  returns_on: string;
  trip_cost: number;
}

export interface PlanLimits {
  plan: string;
  name: string;
  trip_cancellation_max: number;
  trip_delay_waiting_hours: number;
  trip_delay_max: number;
  baggage_delay_waiting_hours: number;
  baggage_delay_max: number;
  baggage_max: number;
  per_item_limit: number;
  passport_max: number;
  emergency_medical_max: number;
  deductible: number;
}

export interface AddOn {
  add_on: string;
  name: string;
  effect: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface PreviousClaim {
  claim_id: string;
  filed_on: string;
  incident_date: string;
  claim_type: string;
  summary: string;
  outcome: string;
  amount_paid: number;
}

export interface Customer {
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  address: Address;
  customer_since: string;
  previous_claims: PreviousClaim[];
}

export interface Policy {
  policy_id: string;
  customer_id: string;
  plan: string;
  purchased_on: string;
  sold_through: string;
  status: string;
  trip: Trip;
  travelers: string[];
  plan_limits: PlanLimits;
  deductible_applies_to: string[];
  add_ons: AddOn[];
}

export interface ClaimEvent {
  seq: number;
  step: string;
  created_at: string;
}

export interface DecisionDetail {
  decision: Decision;
  payout: number;
  explanation: string;
  policy_section: string;
}

export interface Claim {
  claim_id: string;
  policy_id: string;
  customer_id: string;
  claim_type: string;
  submitted_on: string;
  incident_date: string;
  incident_location: string;
  summary: string;
  story: string;
  items: ClaimItem[];
  documents: ClaimDocument[];
  amount_claimed: number;
  status: Status;
  decision: DecisionDetail | null;
  signed_off_by: string | null;
  paid_amount: number | null;
  policy: Policy;
  customer: Customer;
  events: ClaimEvent[];
}

const dollar = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function money(amount: number): string {
  return dollar.format(amount);
}

export function statusLabel(status: Status): string {
  const labels: Record<Status, string> = {
    waiting: "Waiting",
    in_progress: "In progress",
    waiting_for_signoff: "Waiting for sign-off",
    decided: "Decided",
  };
  return labels[status];
}

export function decisionLabel(decision: Decision): string {
  const labels: Record<Decision, string> = {
    approve: "Approved",
    decline: "Declined",
    refer: "Referred",
  };
  return labels[decision];
}

export function claimTypeLabel(claimType: string): string {
  const words = claimType.split("_");
  return words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(" ");
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`The backend returned ${String(response.status)}`);
  }
  return response.json();
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const detail = (payload as { detail?: unknown }).detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : `The backend returned ${String(response.status)}`,
    );
  }
  return payload;
}

export async function fetchQueue(): Promise<QueueClaim[]> {
  const body = (await getJson("/api/claims")) as { claims: QueueClaim[] };
  return body.claims;
}

export async function fetchClaim(claimId: string): Promise<Claim> {
  return (await getJson(`/api/claims/${claimId}`)) as Claim;
}

export async function fetchHandlers(): Promise<Handler[]> {
  const body = (await getJson("/api/handlers")) as { handlers: Handler[] };
  return body.handlers;
}

export async function fetchInstructions(): Promise<string> {
  const body = (await getJson("/api/instructions")) as {
    instructions: string;
  };
  return body.instructions;
}

export async function runAgent(claimId: string): Promise<void> {
  await postJson(`/api/claims/${claimId}/run`, {});
}

export async function signoffClaim(
  claimId: string,
  handlerId: string,
): Promise<void> {
  await postJson(`/api/claims/${claimId}/signoff`, { handler_id: handlerId });
}

export async function payClaim(claimId: string, amount: number): Promise<void> {
  await postJson(`/api/claims/${claimId}/pay`, { amount });
}
