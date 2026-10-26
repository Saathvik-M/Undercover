"""The UnderCover backend."""

import time
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field

from backend import db

app = FastAPI(title="UnderCover")


class Step(BaseModel):
    """A step the agent took on a claim."""

    step: str = Field(min_length=1)


class Decision(BaseModel):
    """The agent's decision on a claim."""

    decision: Literal["approve", "decline", "refer"]
    payout: float = Field(ge=0)
    explanation: str = Field(min_length=1)
    policy_section: str = Field(min_length=1)


class Payment(BaseModel):
    """A payment against a decided claim."""

    amount: float = Field(ge=0)


class Signoff(BaseModel):
    """A handler's sign-off for an over-limit payout."""

    handler_id: str = Field(min_length=1)


@app.get("/api/health", operation_id="health")
def health() -> dict[str, str]:
    """Check that the backend is running."""
    return {"status": "ok"}


@app.get("/api/instructions", operation_id="get_instructions")
def instructions() -> dict[str, str]:
    """Return the agent's instructions."""
    return {"instructions": db.instructions_text()}


@app.get("/api/policy-wording", operation_id="get_policy_wording")
def policy_wording() -> dict[str, str]:
    """Return the full policy wording."""
    return {"wording": db.policy_wording_text()}


@app.get("/api/handlers", operation_id="list_handlers")
def handlers() -> dict[str, list[dict]]:
    """List the claims handlers."""
    return {"handlers": db.handlers()}


@app.get("/api/claims", operation_id="list_claims")
def claims() -> dict[str, list[dict]]:
    """List the claims queue."""
    return {"claims": db.queue()}


@app.get("/api/claims/{claim_id}", operation_id="get_claim")
def claim(claim_id: str) -> dict:
    """Return one claim in full."""
    return _detail(claim_id)


@app.post("/api/claims/{claim_id}/run", operation_id="run_agent")
def run_agent(claim_id: str, background: BackgroundTasks) -> dict[str, bool]:
    """Schedule the agent to work a waiting claim."""
    brief = _brief(claim_id)
    if brief["status"] != db.WAITING:
        raise HTTPException(status_code=409, detail=f"Claim {claim_id} is not waiting")
    thread_id = f"{claim_id}-{time.time_ns()}"
    background.add_task(_work_claim, claim_id, thread_id)
    return {"started": True}


@app.post("/api/claims/{claim_id}/start", operation_id="start_claim")
def start(claim_id: str) -> dict:
    """Mark a waiting claim in progress."""
    _brief(claim_id)
    if not db.start_claim(claim_id):
        raise HTTPException(status_code=409, detail="The claim is not waiting")
    return _detail(claim_id)


@app.post("/api/claims/{claim_id}/events", operation_id="record_step")
def events(claim_id: str, step: Step) -> dict:
    """Record one step the agent took on a claim."""
    _brief(claim_id)
    return db.record_step(claim_id, step.step)


@app.post("/api/claims/{claim_id}/decide", operation_id="decide_claim")
def decide(claim_id: str, decision: Decision) -> dict:
    """Record the agent's decision on a claim."""
    brief = _brief(claim_id)
    if brief["decision"] is not None:
        raise HTTPException(status_code=409, detail="The claim is already decided")
    db.decide(
        claim_id,
        decision.decision,
        decision.payout,
        decision.explanation,
        decision.policy_section,
    )
    return _detail(claim_id)


@app.post("/api/claims/{claim_id}/pay", operation_id="pay_claim")
def pay(claim_id: str, payment: Payment) -> dict:
    """Pay an approved claim, blocking payouts over the approval limit."""
    brief = _brief(claim_id)
    if brief["decision"] != "approve":
        raise HTTPException(
            status_code=409, detail="Only an approved claim can be paid"
        )
    if payment.amount > brief["payout"]:
        raise HTTPException(status_code=409, detail="Pay the decided payout")
    limit = db.payout_limit()
    if payment.amount > limit and brief["signed_off_by"] is None:
        db.set_status(claim_id, db.WAITING_SIGNOFF)
        raise HTTPException(
            status_code=403,
            detail=(
                f"A payout of ${payment.amount:,.2f} is over the ${limit:,.2f}"
                " approval limit and waits for a handler's sign-off"
            ),
        )
    db.pay(claim_id, payment.amount)
    return _detail(claim_id)


@app.post("/api/claims/{claim_id}/signoff", operation_id="signoff_claim")
def signoff(claim_id: str, signoff: Signoff) -> dict:
    """Record a handler's sign-off for the claim."""
    brief = _brief(claim_id)
    if brief["decision"] is None:
        raise HTTPException(status_code=409, detail="The claim has no decision")
    handler = next(
        (h for h in db.handlers() if h["handler_id"] == signoff.handler_id), None
    )
    if handler is None:
        raise HTTPException(
            status_code=404, detail=f"Unknown handler {signoff.handler_id}"
        )
    db.signoff(claim_id, handler["name"])
    return _detail(claim_id)


def _brief(claim_id: str) -> dict:
    brief = db.claim_brief(claim_id)
    if brief is None:
        raise HTTPException(status_code=404, detail=f"Unknown claim {claim_id}")
    return brief


def _detail(claim_id: str) -> dict:
    detail = db.claim_detail(claim_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Unknown claim {claim_id}")
    return detail


def _work_claim(claim_id: str, thread_id: str) -> None:
    """Run the agent on one claim; imported here to keep the coupling loose."""
    from agent import main as agent_main  # noqa: PLC0415

    agent_main.run(claim_id, thread_id)
