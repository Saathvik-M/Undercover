"""The UnderCover backend."""

from fastapi import FastAPI, HTTPException

from backend import db

app = FastAPI(title="UnderCover")


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
    detail = db.claim_detail(claim_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Unknown claim {claim_id}")
    return detail
