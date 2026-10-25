import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "../components/Badge";
import {
  decisionLabel,
  fetchClaim,
  fetchHandlers,
  money,
  payClaim,
  runAgent,
  signoffClaim,
  statusLabel,
  type Claim,
  type Handler,
} from "../api";
import {
  ActivityCard,
  CustomerCard,
  DecisionCard,
  ItemsCard,
  PolicyCard,
} from "./ClaimCards";

const POLL_MS = 3000;

interface ActionsProps {
  claim: Claim;
  handlers: Handler[];
  handlerId: string;
  busy: boolean;
  error: string | null;
  onHandlerChange: (handlerId: string) => void;
  onRun: () => void;
  onSignoff: () => void;
  onPay: () => void;
}

function Actions({
  claim,
  handlers,
  handlerId,
  busy,
  error,
  onHandlerChange,
  onRun,
  onSignoff,
  onPay,
}: Readonly<ActionsProps>) {
  const decision = claim.decision;
  const canSignoff =
    claim.status === "waiting_for_signoff" && claim.signed_off_by === null;
  const canPay =
    claim.status === "waiting_for_signoff" &&
    claim.signed_off_by !== null &&
    claim.paid_amount === null;
  if (claim.status !== "waiting" && !canSignoff && !canPay) {
    return null;
  }
  return (
    <div className="actions">
      {claim.status === "waiting" && (
        <button type="button" className="btn" disabled={busy} onClick={onRun}>
          Run agent
        </button>
      )}
      {canSignoff && (
        <>
          <select
            aria-label="Handler"
            value={handlerId}
            onChange={(event) => {
              onHandlerChange(event.target.value);
            }}
          >
            {handlers.map((handler) => (
              <option key={handler.handler_id} value={handler.handler_id}>
                {handler.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onSignoff}
          >
            Sign off
          </button>
        </>
      )}
      {canPay && decision !== null && (
        <button type="button" className="btn" disabled={busy} onClick={onPay}>
          Pay {money(decision.payout)}
        </button>
      )}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

export function Claim() {
  const { claimId = "" } = useParams();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [failed, setFailed] = useState(false);
  const [handlers, setHandlers] = useState<Handler[]>([]);
  const [handlerId, setHandlerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    void fetchClaim(claimId)
      .then((detail) => {
        setClaim(detail);
        setFailed(false);
      })
      .catch(() => {
        setFailed(true);
      });
  }, [claimId]);

  useEffect(() => {
    load();
    void fetchHandlers().then((rows) => {
      setHandlers(rows);
      setHandlerId(rows[0]?.handler_id ?? "");
    });
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [load]);

  const act = (action: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    void action()
      .then(() => {
        load();
      })
      .catch((error: unknown) => {
        setActionError(String(error));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  if (!claim) {
    return (
      <p className="empty">
        {failed ? "The claim is unavailable." : "Loading the claim…"}
      </p>
    );
  }

  return (
    <section>
      <div className="card claim-head">
        <h1 className="mono">{claim.claim_id}</h1>
        <div className="badges">
          <Badge kind={claim.status}>{statusLabel(claim.status)}</Badge>
          {claim.decision && (
            <Badge kind={claim.decision.decision}>
              {decisionLabel(claim.decision.decision)}
            </Badge>
          )}
        </div>
        <p className="summary">{claim.summary}</p>
      </div>

      <Actions
        claim={claim}
        handlers={handlers}
        handlerId={handlerId}
        busy={busy}
        error={actionError}
        onHandlerChange={setHandlerId}
        onRun={() => {
          act(() => runAgent(claim.claim_id));
        }}
        onSignoff={() => {
          act(() => signoffClaim(claim.claim_id, handlerId));
        }}
        onPay={() => {
          const decision = claim.decision;
          if (decision !== null) {
            act(() => payClaim(claim.claim_id, decision.payout));
          }
        }}
      />

      {claim.status === "in_progress" && (
        <p className="empty">The agent is working on this claim.</p>
      )}

      <ItemsCard claim={claim} />
      <PolicyCard claim={claim} />
      <CustomerCard claim={claim} />
      <DecisionCard claim={claim} />
      <ActivityCard claim={claim} />
    </section>
  );
}
