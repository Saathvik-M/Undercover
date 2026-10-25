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

export async function fetchQueue(): Promise<QueueClaim[]> {
  const body = (await getJson("/api/claims")) as { claims: QueueClaim[] };
  return body.claims;
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
