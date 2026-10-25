import { Badge } from "../components/Badge";
import { claimTypeLabel, decisionLabel, money, type Claim } from "../api";

function limitLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replaceAll("_", " ");
}

function limitValue(key: string, value: number): string {
  if (key.endsWith("_hours")) {
    return `${String(value)} hours`;
  }
  if (key.endsWith("_max") || key === "deductible") {
    return money(value);
  }
  return String(value);
}

function planLimitRows(
  plan: Claim["policy"]["plan_limits"],
): [string, number][] {
  const rows: [string, number][] = [];
  for (const [key, value] of Object.entries(plan)) {
    if (typeof value === "number" && key !== "plan" && key !== "name") {
      rows.push([key, value]);
    }
  }
  return rows;
}

export function ItemsCard({ claim }: Readonly<{ claim: Claim }>) {
  return (
    <div className="card">
      <h2>The claim</h2>
      <p>{claim.story}</p>
      <table>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {claim.items.map((item) => (
            <tr key={item.description}>
              <td>{item.description}</td>
              <td>{claimTypeLabel(item.category)}</td>
              <td className="mono">{money(item.amount)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}>Claimed</td>
            <td className="mono">{money(claim.amount_claimed)}</td>
          </tr>
        </tbody>
      </table>
      {claim.documents.map((document) => (
        <div key={document.name} className="doc">
          <strong>{document.name}</strong>{" "}
          <span className="empty">{document.type}</span>
          <p className="doc-content">{document.content}</p>
        </div>
      ))}
    </div>
  );
}

export function PolicyCard({ claim }: Readonly<{ claim: Claim }>) {
  return (
    <div className="card">
      <h2>Policy</h2>
      <dl className="kv">
        <dt>Policy</dt>
        <dd className="mono">{claim.policy.policy_id}</dd>
        <dt>Plan</dt>
        <dd>{claim.policy.plan_limits.name}</dd>
        <dt>Purchased</dt>
        <dd className="mono">{claim.policy.purchased_on}</dd>
        <dt>Trip</dt>
        <dd>
          {claim.policy.trip.destination}, {claim.policy.trip.departs_on} to{" "}
          {claim.policy.trip.returns_on}
        </dd>
        <dt>Travelers</dt>
        <dd>{claim.policy.travelers.join(", ")}</dd>
        <dt>Policy status</dt>
        <dd>{claim.policy.status}</dd>
      </dl>
      <table>
        <thead>
          <tr>
            <th scope="col">Limit</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {planLimitRows(claim.policy.plan_limits).map(([key, value]) => (
            <tr key={key}>
              <td>{limitLabel(key)}</td>
              <td className="mono">{limitValue(key, value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {claim.policy.add_ons.length > 0 && (
        <div>
          <h3>Add-ons</h3>
          {claim.policy.add_ons.map((addOn) => (
            <p key={addOn.add_on}>
              <strong>{addOn.name}:</strong> {addOn.effect}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerCard({ claim }: Readonly<{ claim: Claim }>) {
  return (
    <div className="card">
      <h2>Customer</h2>
      <dl className="kv">
        <dt>Name</dt>
        <dd>{claim.customer.name}</dd>
        <dt>Email</dt>
        <dd>{claim.customer.email}</dd>
        <dt>Phone</dt>
        <dd className="mono">{claim.customer.phone}</dd>
        <dt>Customer since</dt>
        <dd className="mono">{claim.customer.customer_since}</dd>
      </dl>
      {claim.customer.previous_claims.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">Earlier claim</th>
              <th scope="col">Filed</th>
              <th scope="col">Outcome</th>
              <th scope="col">Paid</th>
            </tr>
          </thead>
          <tbody>
            {claim.customer.previous_claims.map((previous) => (
              <tr key={previous.claim_id}>
                <td>{previous.summary}</td>
                <td className="mono">{previous.filed_on}</td>
                <td>{previous.outcome}</td>
                <td className="mono">{money(previous.amount_paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function DecisionCard({ claim }: Readonly<{ claim: Claim }>) {
  const decision = claim.decision;
  return (
    <div className="card">
      <h2>Agent decision</h2>
      {decision ? (
        <div>
          <p>
            <Badge kind={decision.decision}>
              {decisionLabel(decision.decision)}
            </Badge>{" "}
            {decision.decision === "approve" && (
              <strong className="mono">{money(decision.payout)}</strong>
            )}
          </p>
          <p>{decision.explanation}</p>
          <p className="empty">{decision.policy_section}</p>
          {claim.signed_off_by !== null && (
            <p>{`Signed off by ${claim.signed_off_by}.`}</p>
          )}
          {claim.paid_amount !== null && (
            <p>{`Paid ${money(claim.paid_amount)}.`}</p>
          )}
        </div>
      ) : (
        <p className="empty">The agent has not decided yet.</p>
      )}
    </div>
  );
}

export function ActivityCard({ claim }: Readonly<{ claim: Claim }>) {
  return (
    <div className="card">
      <h2>Agent activity</h2>
      {claim.events.length === 0 ? (
        <p className="empty">No steps recorded yet.</p>
      ) : (
        <ol className="timeline">
          {claim.events.map((event) => (
            <li key={event.seq}>
              <span className="mono">{String(event.seq)}</span>
              <span>{event.step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
