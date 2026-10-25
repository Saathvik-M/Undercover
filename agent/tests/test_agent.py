import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from agent import main
from backend import db
from backend.main import app

client = TestClient(app)


class StubModel(GenericFakeChatModel):
    """A chat model that gives scripted replies in place of a real model."""

    def bind_tools(self, tools, **kwargs):
        return self


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(main, "backend", lambda: TestClient(app))


def call(message: AIMessage) -> AIMessage:
    return AIMessage(
        content="",
        tool_calls=[{**message.tool_calls[0], "id": "1"}],
    )


def test_get_claim():
    claim = main.get_claim.invoke({"claim_id": "CLM-1001"})
    assert claim["policy_id"] == "POL-2001"
    assert claim["policy"]["plan_limits"]["trip_delay_waiting_hours"] == 6


def test_get_claim_unknown():
    assert main.get_claim.invoke({"claim_id": "CLM-9999"}) == "Unknown claim CLM-9999"


def test_get_policy_wording():
    assert "Trip Delay" in main.get_policy_wording.invoke({})


def test_record_step():
    main.record_step.invoke({"claim_id": "CLM-1001", "step": "Read the claim"})
    events = client.get("/api/claims/CLM-1001").json()["events"]
    assert [event["step"] for event in events] == ["Read the claim"]


def test_decide():
    main.decide.invoke(
        {
            "claim_id": "CLM-1001",
            "decision": "approve",
            "payout": 420.0,
            "explanation": "Covered after the 6 hour wait.",
            "policy_section": "Section 3, Trip Delay",
        }
    )
    detail = client.get("/api/claims/CLM-1001").json()
    assert detail["decision"]["decision"] == "approve"
    assert detail["status"] == "in_progress"


def test_pay_under_the_limit():
    main.decide.invoke(
        {
            "claim_id": "CLM-1001",
            "decision": "approve",
            "payout": 420.0,
            "explanation": "Covered.",
            "policy_section": "Section 3, Trip Delay",
        }
    )
    main.pay.invoke({"claim_id": "CLM-1001", "amount": 420.0})
    detail = client.get("/api/claims/CLM-1001").json()
    assert detail["status"] == "decided"
    assert detail["paid_amount"] == 420.0


def test_pay_over_the_limit_is_blocked_not_raised():
    main.decide.invoke(
        {
            "claim_id": "CLM-1001",
            "decision": "approve",
            "payout": 1500.0,
            "explanation": "Covered.",
            "policy_section": "Section 2",
        }
    )
    reply = main.pay.invoke({"claim_id": "CLM-1001", "amount": 1500.0})
    assert "approval limit" in reply
    assert client.get("/api/claims/CLM-1001").json()["status"] == "waiting_for_signoff"


def scripted_run(*tool_calls: dict, reply: str):
    messages = [
        AIMessage(content="", tool_calls=[{**call_spec, "id": str(number)}])
        for number, call_spec in enumerate(tool_calls, start=1)
    ]
    messages.append(AIMessage(content=reply))
    return StubModel(messages=iter(messages))


DECIDE = {
    "name": "decide",
    "args": {
        "claim_id": "CLM-1001",
        "decision": "approve",
        "payout": 420.0,
        "explanation": "Covered after the 6 hour wait.",
        "policy_section": "Section 3, Trip Delay",
    },
}
PAY = {"name": "pay", "args": {"claim_id": "CLM-1001", "amount": 420.0}}


def test_run_works_the_claim_to_a_payment():
    reply = main.run(
        "CLM-1001",
        "thread-1",
        scripted_run(DECIDE, PAY, reply="Approved $420 for the trip delay."),
    )
    assert reply == "Approved $420 for the trip delay."
    detail = client.get("/api/claims/CLM-1001").json()
    assert detail["status"] == "decided"
    assert detail["paid_amount"] == 420.0


def test_run_records_a_blocked_payment_without_retrying():
    over_limit = {**DECIDE, "args": {**DECIDE["args"], "payout": 1500.0}}
    blocked_pay = {**PAY, "args": {**PAY["args"], "amount": 1500.0}}
    step = {
        "name": "record_step",
        "args": {
            "claim_id": "CLM-1001",
            "step": "Payment over the limit: waits for sign-off",
        },
    }
    main.run(
        "CLM-1001",
        "thread-1",
        scripted_run(over_limit, blocked_pay, step, reply="Waits for a sign-off."),
    )
    detail = client.get("/api/claims/CLM-1001").json()
    assert detail["status"] == "waiting_for_signoff"
    assert detail["paid_amount"] is None
    assert detail["events"][-1]["step"] == (
        "Payment over the limit: waits for sign-off"
    )


def test_run_marks_the_claim_in_progress():
    main.run("CLM-1001", "thread-1", scripted_run(reply="I need more information."))
    assert client.get("/api/claims/CLM-1001").json()["status"] == "in_progress"


def test_model_name(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.delenv("MODEL_NAME", raising=False)
    assert main.model().model_name == "openai/gpt-6-luna"
    monkeypatch.setenv("MODEL_NAME", "openrouter/free")
    assert main.model().model_name == "openrouter/free"
