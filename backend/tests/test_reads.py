import pytest
from fastapi.testclient import TestClient

from backend import db
from backend.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_queue_seeds_every_claim_waiting():
    claims = client.get("/api/claims").json()["claims"]
    assert len(claims) == 25
    assert all(claim["status"] == "waiting" for claim in claims)
    first = claims[0]
    assert first["claim_id"] == "CLM-1001"
    assert first["customer_name"] == "Maya Patel"
    assert first["claim_type"] == "trip_delay"
    assert first["amount_claimed"] == 420.0
    assert first["decision"] is None


def test_claim_detail():
    detail = client.get("/api/claims/CLM-1001").json()
    assert detail["summary"] == (
        "Flight home canceled by the airline, rebooked the next morning"
    )
    assert detail["items"][0] == {
        "description": "Airport hotel, one night",
        "category": "accommodation",
        "amount": 245.0,
    }
    assert detail["documents"][0]["type"] == "carrier_report"
    assert detail["decision"] is None
    assert detail["signed_off_by"] is None
    assert detail["paid_amount"] is None
    assert detail["events"] == []


def test_claim_detail_joins_policy_and_customer():
    detail = client.get("/api/claims/CLM-1001").json()
    policy = detail["policy"]
    assert policy["policy_id"] == "POL-2001"
    assert policy["plan"] == "premium"
    assert policy["plan_limits"]["trip_cancellation_max"] == 5000.0
    assert policy["deductible_applies_to"] == ["baggage", "emergency_medical"]
    assert policy["trip"]["destination"] == "Rome, Italy"
    assert policy["travelers"] == ["Maya Patel"]
    customer = detail["customer"]
    assert customer["name"] == "Maya Patel"
    assert len(customer["previous_claims"]) == 1
    assert customer["previous_claims"][0]["claim_id"] == "CLM-0412"


def test_claim_detail_expands_add_ons():
    with db.connect() as connection:
        connection.execute(
            "UPDATE policies SET add_ons = ? WHERE policy_id = 'POL-2001'",
            ('["electronics_plus", "adventure_sports"]',),
        )
    add_ons = client.get("/api/claims/CLM-1001").json()["policy"]["add_ons"]
    assert [add_on["add_on"] for add_on in add_ons] == [
        "adventure_sports",
        "electronics_plus",
    ]
    assert add_ons[1]["electronics_per_item_limit"] == 1200.0


def test_unknown_claim_is_not_found():
    assert client.get("/api/claims/CLM-9999").status_code == 404


def test_policy_wording():
    wording = client.get("/api/policy-wording").json()["wording"]
    assert "Trip Delay" in wording
    assert "How we work out your payment" in wording


def test_instructions():
    instructions = client.get("/api/instructions").json()["instructions"]
    assert "UnderCover Agent" in instructions


def test_handlers():
    handlers = client.get("/api/handlers").json()["handlers"]
    assert [handler["handler_id"] for handler in handlers] == [
        "HND-01",
        "HND-02",
        "HND-03",
    ]
