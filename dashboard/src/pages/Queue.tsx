import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/Badge";
import {
  claimTypeLabel,
  decisionLabel,
  fetchQueue,
  money,
  statusLabel,
  type QueueClaim,
} from "../api";

const POLL_MS = 3000;

export function Queue() {
  const [claims, setClaims] = useState<QueueClaim[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    const load = () => {
      void fetchQueue()
        .then((rows) => {
          if (current) {
            setClaims(rows);
            setFailed(false);
          }
        })
        .catch(() => {
          if (current) {
            setFailed(true);
          }
        });
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, []);

  if (!claims) {
    return (
      <p className="empty">
        {failed ? "The queue is unavailable." : "Loading the queue…"}
      </p>
    );
  }

  return (
    <section>
      <h1>Claims queue</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th scope="col">Claim</th>
              <th scope="col">Customer</th>
              <th scope="col">Type</th>
              <th scope="col">Claimed</th>
              <th scope="col">Status</th>
              <th scope="col">Decision</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.claim_id}>
                <td>
                  <Link
                    to={`/claims/${claim.claim_id}`}
                    className="claim-id mono"
                  >
                    {claim.claim_id}
                  </Link>
                </td>
                <td>{claim.customer_name}</td>
                <td>{claimTypeLabel(claim.claim_type)}</td>
                <td className="mono">{money(claim.amount_claimed)}</td>
                <td>
                  <Badge kind={claim.status}>{statusLabel(claim.status)}</Badge>
                </td>
                <td>
                  {claim.decision === null ? (
                    <span className="empty">—</span>
                  ) : (
                    <Badge kind={claim.decision.decision}>
                      {decisionLabel(claim.decision.decision)}
                      {claim.decision.decision === "approve" &&
                        ` ${money(claim.decision.payout)}`}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
