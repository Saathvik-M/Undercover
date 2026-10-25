"""The UnderCover database: SQLite, seeded from data/ on first use."""

import json
import sqlite3
from contextlib import closing
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = Path(__file__).resolve().parent / "undercover.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS policies (
    policy_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    add_ons TEXT NOT NULL,
    purchased_on TEXT NOT NULL,
    sold_through TEXT NOT NULL,
    trip TEXT NOT NULL,
    travelers TEXT NOT NULL,
    status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
    customer_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    address TEXT NOT NULL,
    customer_since TEXT NOT NULL,
    previous_claims TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS claims (
    claim_id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    submitted_on TEXT NOT NULL,
    incident_date TEXT NOT NULL,
    incident_location TEXT NOT NULL,
    summary TEXT NOT NULL,
    story TEXT NOT NULL,
    items TEXT NOT NULL,
    documents TEXT NOT NULL,
    amount_claimed REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    decision TEXT,
    payout REAL,
    explanation TEXT,
    policy_section TEXT,
    decided_at TEXT,
    signed_off_by TEXT,
    paid_amount REAL
);
CREATE TABLE IF NOT EXISTS events (
    claim_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    step TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (claim_id, seq)
);
"""

WAITING = "waiting"
DECISION_FIELDS = ("decision", "payout", "explanation", "policy_section")


def connect() -> sqlite3.Connection:
    """Open a connection, creating the schema and seed data if needed."""
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.executescript(SCHEMA)
    empty = connection.execute("SELECT COUNT(*) FROM claims").fetchone()[0] == 0
    if empty:
        _load(connection)
    return connection


def _load(connection: sqlite3.Connection) -> None:
    policies = _read_list("policies.json")
    customers = _read_list("customers.json")
    claims = _read_list("claims.json")
    connection.executemany(
        "INSERT INTO policies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (
                p["policy_id"],
                p["customer_id"],
                p["plan"],
                _dumps(p["add_ons"]),
                p["purchased_on"],
                p["sold_through"],
                _dumps(p["trip"]),
                _dumps(p["travelers"]),
                p["status"],
            )
            for p in policies
        ],
    )
    connection.executemany(
        "INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (
                c["customer_id"],
                c["name"],
                c["email"],
                c["phone"],
                c["date_of_birth"],
                _dumps(c["address"]),
                c["customer_since"],
                _dumps(c["previous_claims"]),
            )
            for c in customers
        ],
    )
    connection.executemany(
        "INSERT INTO claims (claim_id, policy_id, customer_id, claim_type,"
        " submitted_on, incident_date, incident_location, summary, story, items,"
        " documents, amount_claimed, status)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (
                c["claim_id"],
                c["policy_id"],
                c["customer_id"],
                c["claim_type"],
                c["submitted_on"],
                c["incident_date"],
                c["incident_location"],
                c["summary"],
                c["story"],
                _dumps(c["items"]),
                _dumps(c["documents"]),
                c["amount_claimed"],
                WAITING,
            )
            for c in claims
        ],
    )


def _read_list(name: str) -> list[dict]:
    """Read a JSON file that holds a list of records."""
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def _read_plans() -> dict:
    """Read the plans, add-ons and deductible settings."""
    return json.loads((DATA_DIR / "plans.json").read_text(encoding="utf-8"))


def _dumps(value: list | dict) -> str:
    return json.dumps(value)


def _row(row: sqlite3.Row, json_fields: tuple[str, ...] = ()) -> dict:
    values = dict(row)
    for field in json_fields:
        values[field] = json.loads(values[field])
    return values


def queue() -> list[dict]:
    """Return every claim for the queue, joined with the customer name."""
    sql = (
        "SELECT c.claim_id, cu.name AS customer_name, c.claim_type, c.amount_claimed,"
        " c.status, c.decision, c.payout FROM claims c"
        " JOIN customers cu ON cu.customer_id = c.customer_id ORDER BY c.claim_id"
    )
    with closing(connect()) as connection:
        rows = connection.execute(sql).fetchall()
    return [
        {
            "claim_id": row["claim_id"],
            "customer_name": row["customer_name"],
            "claim_type": row["claim_type"],
            "amount_claimed": row["amount_claimed"],
            "status": row["status"],
            "decision": (
                {"decision": row["decision"], "payout": row["payout"]}
                if row["decision"]
                else None
            ),
        }
        for row in rows
    ]


def claim_detail(claim_id: str) -> dict | None:
    """Return one claim in full, with its policy, customer and events."""
    with closing(connect()) as connection:
        row = connection.execute(
            "SELECT * FROM claims WHERE claim_id = ?", (claim_id,)
        ).fetchone()
        if row is None:
            return None
        claim = _row(row)
        claim["items"] = json.loads(claim["items"])
        claim["documents"] = json.loads(claim["documents"])
        decided = {key: claim.pop(key) for key in DECISION_FIELDS}
        claim["decision"] = decided if decided["decision"] else None
        claim["policy"] = _policy(connection, row["policy_id"])
        claim["customer"] = _customer(connection, row["customer_id"])
        claim["events"] = [
            _row(event)
            for event in connection.execute(
                "SELECT seq, step, created_at FROM events WHERE claim_id = ?"
                " ORDER BY seq",
                (claim_id,),
            ).fetchall()
        ]
    return claim


def _policy(connection: sqlite3.Connection, policy_id: str) -> dict:
    row = connection.execute(
        "SELECT * FROM policies WHERE policy_id = ?", (policy_id,)
    ).fetchone()
    policy = _row(row, json_fields=("add_ons", "trip", "travelers"))
    plans = _read_plans()
    plan = next(p for p in plans["plans"] if p["plan"] == policy["plan"])
    policy["plan_limits"] = plan
    policy["deductible_applies_to"] = plans["deductible_applies_to"]
    chosen = policy["add_ons"]
    policy["add_ons"] = [a for a in plans["add_ons"] if a["add_on"] in chosen]
    return policy


def _customer(connection: sqlite3.Connection, customer_id: str) -> dict:
    row = connection.execute(
        "SELECT * FROM customers WHERE customer_id = ?", (customer_id,)
    ).fetchone()
    return _row(row, json_fields=("address", "previous_claims"))


def policy_wording_text() -> str:
    """Return the full policy wording."""
    return (DATA_DIR / "policy_wording.md").read_text(encoding="utf-8")


def instructions_text() -> str:
    """Return the agent's instructions."""
    return (Path(__file__).resolve().parent / "instructions.md").read_text(
        encoding="utf-8"
    )


def handlers() -> list[dict]:
    """Return the claims handlers."""
    return _read_list("handlers.json")
