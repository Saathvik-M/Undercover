import pytest
from fastapi.testclient import TestClient

from agent import main as agent_main
from backend import db
from backend.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")


def decide(claim_id: str, payout: float, decision: str = "approve"):
    return client.post(
        f"/api/claims/{claim_id}/decide",
        json={
            "decision": decision,
            "payout": payout,
            "explanation": "The wording covers the loss.",
            "policy_section": "Section 3, Trip Delay",
        },
    )


def test_start_moves_a_waiting_claim_to_in_progress():
    assert client.post("/api/claims/CLM-1001/start").json()["status"] == "in_progress"
    assert client.post("/api/claims/CLM-1001/start").status_code == 409


def test_events_are_recorded_in_order():
    client.post("/api/claims/CLM-1001/events", json={"step": "Read the claim"})
    client.post("/api/claims/CLM-1001/events", json={"step": "Read Section 3"})
    events = client.get("/api/claims/CLM-1001").json()["events"]
    assert [event["seq"] for event in events] == [1, 2]
    assert [event["step"] for event in events] == ["Read the claim", "Read Section 3"]
    assert all(event["created_at"] for event in events)


def test_approve_and_pay_under_the_limit():
    decided = decide("CLM-1001", 420.0).json()
    assert decided["decision"]["decision"] == "approve"
    assert decided["decision"]["payout"] == 420.0
    assert decided["status"] == "in_progress"
    assert decided["decided_at"]
    paid = client.post("/api/claims/CLM-1001/pay", json={"amount": 420.0}).json()
    assert paid["status"] == "decided"
    assert paid["paid_amount"] == 420.0


def test_pay_over_the_limit_waits_for_signoff():
    decide("CLM-1001", 1500.0)
    blocked = client.post("/api/claims/CLM-1001/pay", json={"amount": 1500.0})
    assert blocked.status_code == 403
    assert "approval limit" in blocked.json()["detail"]
    detail = client.get("/api/claims/CLM-1001").json()
    assert detail["status"] == "waiting_for_signoff"
    assert detail["paid_amount"] is None
    signed = client.post(
        "/api/claims/CLM-1001/signoff", json={"handler_id": "HND-01"}
    ).json()
    assert signed["signed_off_by"] == "Dana Whitfield"
    assert signed["status"] == "waiting_for_signoff"
    paid = client.post("/api/claims/CLM-1001/pay", json={"amount": 1500.0}).json()
    assert paid["status"] == "decided"
    assert paid["paid_amount"] == 1500.0


def test_decline_and_refer_end_the_claim():
    declined = decide("CLM-1001", 0.0, "decline").json()
    assert declined["status"] == "decided"
    referred = decide("CLM-1002", 0.0, "refer").json()
    assert referred["status"] == "decided"


def test_pay_needs_an_approval():
    assert (
        client.post("/api/claims/CLM-1001/pay", json={"amount": 420.0}).status_code
        == 409
    )


def test_pay_cannot_exceed_the_decided_payout():
    decide("CLM-1001", 420.0)
    assert (
        client.post("/api/claims/CLM-1001/pay", json={"amount": 500.0}).status_code
        == 409
    )


def test_signoff_needs_a_known_handler():
    decide("CLM-1001", 1500.0)
    assert (
        client.post(
            "/api/claims/CLM-1001/signoff", json={"handler_id": "HND-99"}
        ).status_code
        == 404
    )


def test_signoff_needs_a_decision():
    assert (
        client.post(
            "/api/claims/CLM-1001/signoff", json={"handler_id": "HND-01"}
        ).status_code
        == 409
    )


def test_decide_rejects_an_unknown_decision():
    assert decide("CLM-1001", 420.0, "maybe").status_code == 422


def test_decide_cannot_decide_twice():
    decide("CLM-1001", 420.0)
    assert decide("CLM-1001", 420.0).status_code == 409


def test_unknown_claims_are_not_found():
    assert client.post("/api/claims/CLM-9999/start").status_code == 404
    assert (
        client.post("/api/claims/CLM-9999/events", json={"step": "x"}).status_code
        == 404
    )
    assert decide("CLM-9999", 0.0).status_code == 404
    assert (
        client.post("/api/claims/CLM-9999/pay", json={"amount": 1.0}).status_code == 404
    )
    assert (
        client.post(
            "/api/claims/CLM-9999/signoff", json={"handler_id": "HND-01"}
        ).status_code
        == 404
    )
    assert client.post("/api/claims/CLM-9999/run").status_code == 404


def test_run_schedules_the_agent_on_a_waiting_claim(monkeypatch):
    calls = []

    def stub_run(claim_id: str, thread_id: str) -> str:
        calls.append((claim_id, thread_id))
        return "done"

    monkeypatch.setattr(agent_main, "run", stub_run)
    started = client.post("/api/claims/CLM-1001/run")
    assert started.status_code == 200
    assert started.json() == {"started": True}
    assert calls == [("CLM-1001", calls[0][1])]
    assert calls[0][1].startswith("CLM-1001-")


def test_run_refuses_a_claim_that_is_not_waiting():
    client.post("/api/claims/CLM-1001/start")
    assert client.post("/api/claims/CLM-1001/run").status_code == 409
